import type { Logger } from "@arcon/shared";
import { FFmpegMicrophoneRecorder } from "./audio/ffmpeg-microphone-recorder.js";
import { WhisperSttRecognizer } from "./stt/whisper-stt-recognizer.js";
import { WindowsSapiSynthesizer } from "./tts/windows-sapi-synthesizer.js";
import { FfmpegFliteSynthesizer } from "./tts/ffmpeg-flite-synthesizer.js";
import { VoiceService } from "./voice-service.js";
import type { ArconChat, SpeechSynthesizer } from "./interfaces.js";
import type { RecordOptions } from "./types.js";
import { VoiceError } from "./errors.js";

export interface VoiceEnvironment {
	pythonPath?: string;
	ffmpegPath?: string;
	ffplayPath?: string;
	powershellPath?: string;
	sttModel?: string;
	cpuThreads?: number;
	tts?: "sapi" | "flite" | "auto";
}

export interface CreateVoiceServiceOptions {
	logger?: Logger;
	environment?: VoiceEnvironment;
	recordOptions?: Partial<RecordOptions>;
}

export async function createLocalVoiceService(
	chat: ArconChat,
	options: CreateVoiceServiceOptions = {},
): Promise<VoiceService> {
	const env = options.environment ?? {};

	const recorder = new FFmpegMicrophoneRecorder({ ffmpegPath: env.ffmpegPath });
	const recognizer = new WhisperSttRecognizer({
		pythonPath: env.pythonPath,
		model: env.sttModel,
		cpuThreads: env.cpuThreads,
	});

	const synthesizer = await createSynthesizer(env);

	return new VoiceService({
		recorder,
		recognizer,
		synthesizer,
		chat,
		logger: options.logger,
		recordOptions: options.recordOptions,
	});
}

async function createSynthesizer(env: VoiceEnvironment): Promise<SpeechSynthesizer> {
	const choice = env.tts ?? (process.platform === "win32" ? "sapi" : "flite");

	if (choice === "sapi") {
		const sapi = new WindowsSapiSynthesizer({ powershellPath: env.powershellPath });
		if (await sapi.isAvailable()) {
			return sapi;
		}
	}

	const flite = new FfmpegFliteSynthesizer({ ffmpegPath: env.ffmpegPath, ffplayPath: env.ffplayPath });
	if (await flite.isAvailable()) {
		return flite;
	}

	throw new VoiceError("TTS_FAILURE", "No local speech synthesizer is available (needs Windows SAPI or ffmpeg flite + ffplay)");
}
