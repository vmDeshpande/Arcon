import type { Logger } from "@arcon/shared";
import { VoiceError, type VoiceErrorCode } from "./errors.js";
import type { AudioRecording, Transcription } from "./types.js";
import type {
	ArconChat,
	AudioRecorder,
	SpeechRecognizer,
	SpeechSynthesizer,
	VoiceEventCallbacks,
	VoiceServiceOptions,
	VoiceTurnResult,
} from "./interfaces.js";

export class VoiceService {
	private readonly options: VoiceServiceOptions;
	private readonly callbacks: VoiceEventCallbacks;
	private readonly logger?: Logger;
	private closed = false;

	constructor(options: VoiceServiceOptions) {
		this.options = options;
		this.callbacks = options.events ?? {};
		this.logger = options.logger;
	}

	async start(): Promise<void> {
		try {
			await this.options.recognizer.start();
		} catch (error) {
			this.log("warn", "Speech recognizer failed to warm up", error);
		}
	}

	async listenAndRespond(): Promise<VoiceTurnResult> {
		if (this.closed) {
			return { ok: false, reason: "CHAT_FAILURE", message: "Voice service is closed" };
		}

		let recording: AudioRecording;
		try {
			this.callbacks.onListening?.();
			this.callbacks.onRecordingStarted?.();
			recording = await this.options.recorder.record(this.options.recordOptions ?? {});
		} catch (error) {
			const ve = this.toVoiceError(error, "MIC_UNAVAILABLE");
			if (ve.code === "NO_SPEECH_DETECTED") {
				this.callbacks.onSilence?.();
				return { ok: false, reason: "NO_SPEECH_DETECTED", message: ve.message };
			}
			this.report(ve, "Capture failed");
			return { ok: false, reason: ve.code, message: ve.message };
		}

		let transcript: Transcription;
		try {
			transcript = await this.options.recognizer.transcribe(recording);
		} catch (error) {
			const ve = this.toVoiceError(error, "STT_FAILURE");
			this.report(ve, "Speech recognition failed");
			return { ok: false, reason: ve.code, message: ve.message };
		}

		const text = transcript.text.trim();
		this.callbacks.onTranscript?.(transcript);
		if (!text) {
			this.callbacks.onSilence?.();
			return { ok: false, reason: "NO_SPEECH_DETECTED", message: "Transcription was empty" };
		}

		let reply: string;
		try {
			reply = (await this.options.chat.chat(text)).reply;
		} catch (error) {
			const ve = this.toVoiceError(error, "CHAT_FAILURE");
			this.report(ve, "Chat service failed");
			return { ok: false, reason: ve.code, message: ve.message };
		}

		this.callbacks.onReply?.(reply);

		try {
			this.callbacks.onSynthesizing?.();
			await this.options.synthesizer.speak(reply);
		} catch (error) {
			const ve = this.toVoiceError(error, "TTS_FAILURE");
			this.report(ve, "Speech synthesis failed");
			return { ok: false, reason: ve.code, message: ve.message };
		}

		return { ok: true, transcript: text, reply };
	}

	async close(): Promise<void> {
		this.closed = true;
		await this.options.recognizer.stop().catch(() => undefined);
		await this.options.recorder.stop().catch(() => undefined);
		await this.options.synthesizer.stop().catch(() => undefined);
	}

	private report(error: VoiceError, context: string): void {
		this.log("error", `${context}: ${error.message}`, error);
		this.callbacks.onError?.(error);
	}

	private toVoiceError(error: unknown, fallbackCode: VoiceErrorCode): VoiceError {
		if (error instanceof VoiceError) {
			return error;
		}
		const message = error instanceof Error ? error.message : String(error);
		return new VoiceError(fallbackCode, message, error);
	}

	private log(level: "info" | "warn" | "error", message: string, error?: unknown): void {
		if (!this.logger) {
			return;
		}
		const metadata: Record<string, unknown> | undefined = error
			? { error: error instanceof Error ? error.message : error }
			: undefined;
		this.logger[level](message, metadata);
	}
}
