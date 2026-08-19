import type { Logger } from "@arcon/shared";
import { FFmpegMicrophoneRecorder } from "./audio/ffmpeg-microphone-recorder.js";
import { WhisperSttRecognizer } from "./stt/whisper-stt-recognizer.js";
import { WindowsSapiSynthesizer } from "./tts/windows-sapi-synthesizer.js";
import { FfmpegFliteSynthesizer } from "./tts/ffmpeg-flite-synthesizer.js";
import { PiperTtsSynthesizer } from "./tts/piper-tts-synthesizer.js";
import { VoiceService } from "./voice-service.js";
import type { ArconChat, SpeechSynthesizer, VoiceEventCallbacks } from "./interfaces.js";
import type { RecordOptions } from "./types.js";
import { VoiceError } from "./errors.js";

export interface VoiceEnvironment {
	pythonPath?: string;
	ffmpegPath?: string;
	ffplayPath?: string;
	powershellPath?: string;
	sttModel?: string;
	cpuThreads?: number;
	tts?: "piper" | "sapi" | "flite" | "auto";
	ttsModel?: string;
	ttsModelDir?: string;
}

export interface CreateVoiceServiceOptions {
	logger?: Logger;
	environment?: VoiceEnvironment;
	recordOptions?: Partial<RecordOptions>;
	events?: VoiceEventCallbacks;
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
		events: options.events,
	});
}

async function createSynthesizer(env: VoiceEnvironment): Promise<SpeechSynthesizer> {
	const choice = env.tts ?? "auto";

	if (choice === "piper" || (choice === "auto" && await piperUsable(env))) {
		const piper = new PiperTtsSynthesizer({
			pythonPath: env.pythonPath,
			model: env.ttsModel,
			modelDir: env.ttsModelDir,
			ffplayPath: env.ffplayPath,
		});
		try {
			await piper.prepare();
			return piper;
		} catch (error) {
			await piper.stop().catch(() => undefined);
			if (choice === "piper") {
				const code = error instanceof VoiceError ? error.code : "TTS_FAILURE";
				throw new VoiceError(code, error instanceof Error ? error.message : String(error), error);
			}
		}
	}

	const sapi = new WindowsSapiSynthesizer({ powershellPath: env.powershellPath });
	if (choice === "sapi" || (await sapi.isAvailable())) {
		return sapi;
	}

	const flite = new FfmpegFliteSynthesizer({ ffmpegPath: env.ffmpegPath, ffplayPath: env.ffplayPath });
	if (await flite.isAvailable()) {
		return flite;
	}

	throw new VoiceError("TTS_FAILURE", "No local speech synthesizer is available (needs Piper + ffmpeg/ffplay, Windows SAPI, or ffmpeg flite + ffplay)");
}

async function piperUsable(env: VoiceEnvironment): Promise<boolean> {
	const probe = new PiperTtsSynthesizer({
		pythonPath: env.pythonPath,
		model: env.ttsModel,
		modelDir: env.ttsModelDir,
		ffplayPath: env.ffplayPath,
	});
	return probe.isAvailable();
}
