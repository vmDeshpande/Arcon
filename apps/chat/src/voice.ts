import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOllamaClient, ChatService } from "@arcon/ai";
import { MemoryPipeline, MemoryRepository } from "@arcon/memory";
import { createLogger } from "@arcon/logger";
import { createLocalVoiceService } from "@arcon/voice";

function repoRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

const root = repoRoot();

const aiClient = createOllamaClient({
	baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
	model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
});

const repository = new MemoryRepository(resolve(root, "apps/chat/data/personal-memory.sqlite"));
const pipeline = new MemoryPipeline(repository);

const chatService = new ChatService(repository, pipeline, aiClient, {
	experienceDatabasePath: resolve(root, "apps/chat/data/experiences.sqlite"),
	moodDatabasePath: resolve(root, "apps/chat/data/mood.sqlite"),
	entityDatabasePath: resolve(root, "apps/chat/data/entities.sqlite"),
});

const logger = createLogger(resolve(root, "apps/chat/data/logs"));

const debug = !!process.env.VOICE_DEBUG;

const chat = {
  chat: async (message: string) => {
    const result = await chatService.chat(message);
    return { reply: result.reply };
  },
  chatStream: (message: string) => chatService.chatStream(message),
  close: () => chatService.close(),
};

const voice = await createLocalVoiceService(chat, {
	logger,
	environment: {
		tts: "auto",
		ttsModel: process.env.PIPER_VOICE_MODEL,
	},
	events: {
		onListening: () => debug && console.log("[voice] listening"),
		onRecordingStarted: () => debug && console.log("[voice] recording"),
		onRecordingEnded: () => debug && console.log("[voice] stopped speaking"),
		onTranscript: (t) => debug && console.log("[voice] transcript:", t.text),
		onReply: (r) => debug && console.log("[voice] reply:", r),
		onSynthesizing: () => debug && console.log("[voice] synthesizing..."),
		onSilence: () => debug && console.log("[voice] (no speech detected)"),
		onError: (error) => console.error("[voice]", error.code, error.message),
		onTurnMetrics: (m) =>
			debug &&
			console.error(
				`[voice] metrics ms  record=${m.recordMs} stt=${m.sttMs} chat=${m.chatMs} tts=${m.ttsMs} toFirstAudio=${m.timeToFirstAudioMs} total=${m.totalTurnMs}`,
			),
	},
});

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log("");
console.log("=================================");
console.log("Arcon Voice Mode");
console.log("type 'exit' to quit");
console.log("=================================");
console.log("");

await voice.start();
console.log("Speech recognition + TTS warmed up. Press ENTER to speak, or type 'exit' to quit.");
console.log(debug ? "Latency metrics enabled (VOICE_DEBUG)." : "Set VOICE_DEBUG=1 to see per-stage latency metrics.");
console.log(process.env.PIPER_VOICE_MODEL ? `Piper voice model: ${process.env.PIPER_VOICE_MODEL}` : "Using default Piper neural voice (set PIPER_VOICE_MODEL to override).");

while (true) {
	const command = (await rl.question("You (ENTER to speak): ")).trim();

	if (command.toLowerCase() === "exit") {
		break;
	}

	console.log("Listening... (speak now; recording stops after you finish)");

	const result = await voice.listenAndRespond();

	console.log("");
	if (result.ok) {
		console.log(`You: ${result.transcript}`);
		console.log(`Arcon: ${result.reply}`);
	} else if (result.reason === "NO_SPEECH_DETECTED") {
		console.log("(no speech detected)");
	} else {
		console.log(`(error: ${result.reason} — ${result.message})`);
	}
	console.log("");
	console.log("Press ENTER to speak again, or type 'exit' to quit.");
}

await voice.close();
chat.close();
repository.close();
rl.close();
