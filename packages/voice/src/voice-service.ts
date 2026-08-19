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
	VoiceTurnMetrics,
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

		try {
			await this.options.synthesizer.prepare?.();
		} catch (error) {
			this.log("warn", "Speech synthesizer failed to pre-warm", error);
		}
	}

	async listenAndRespond(): Promise<VoiceTurnResult> {
		if (this.closed) {
			return { ok: false, reason: "CHAT_FAILURE", message: "Voice service is closed" };
		}

		const turnStart = now();
		const marks = {
			recordStart: turnStart,
			recordEnd: turnStart,
			sttStart: 0,
			sttEnd: 0,
			chatStart: 0,
			chatEnd: 0,
			ttsStart: 0,
			playbackStart: 0,
			end: turnStart,
		};

		const emitMetrics = () => {
			marks.end = now();
			const metrics: VoiceTurnMetrics = {
				recordMs: marks.recordEnd - marks.recordStart,
				sttMs: Math.max(0, marks.sttEnd - marks.sttStart),
				chatMs: Math.max(0, marks.chatEnd - marks.chatStart),
				ttsMs: Math.max(0, marks.end - marks.ttsStart),
				timeToFirstAudioMs: marks.playbackStart
					? marks.playbackStart - marks.recordEnd
					: Math.max(0, marks.end - marks.recordEnd),
				totalTurnMs: marks.end - turnStart,
			};
			this.callbacks.onTurnMetrics?.(metrics);
		};

		let recording: AudioRecording;
		try {
			marks.recordStart = now();
			this.callbacks.onListening?.();
			this.callbacks.onRecordingStarted?.();
			recording = await this.options.recorder.record(this.options.recordOptions ?? {});
			marks.recordEnd = now();
			this.callbacks.onRecordingEnded?.();
		} catch (error) {
			const ve = this.toVoiceError(error, "MIC_UNAVAILABLE");
			if (ve.code === "NO_SPEECH_DETECTED") {
				this.callbacks.onSilence?.();
				emitMetrics();
				return { ok: false, reason: "NO_SPEECH_DETECTED", message: ve.message };
			}
			this.report(ve, "Capture failed");
			emitMetrics();
			return { ok: false, reason: ve.code, message: ve.message };
		}

		let transcript: Transcription;
		try {
			marks.sttStart = now();
			transcript = await this.options.recognizer.transcribe(recording);
			marks.sttEnd = now();
		} catch (error) {
			const ve = this.toVoiceError(error, "STT_FAILURE");
			this.report(ve, "Speech recognition failed");
			emitMetrics();
			return { ok: false, reason: ve.code, message: ve.message };
		}

		const text = transcript.text.trim();
		this.callbacks.onTranscript?.(transcript);
		if (!text) {
			this.callbacks.onSilence?.();
			emitMetrics();
			return { ok: false, reason: "NO_SPEECH_DETECTED", message: "Transcription was empty" };
		}

		let reply: string;
		try {
			marks.chatStart = now();
			reply = (await this.options.chat.chat(text)).reply;
			marks.chatEnd = now();
		} catch (error) {
			const ve = this.toVoiceError(error, "CHAT_FAILURE");
			this.report(ve, "Chat service failed");
			emitMetrics();
			return { ok: false, reason: ve.code, message: ve.message };
		}

		this.callbacks.onReply?.(reply);

		try {
			marks.ttsStart = now();
			this.callbacks.onSynthesizing?.();
			await this.options.synthesizer.speak(reply, () => {
				marks.playbackStart = now();
			});
		} catch (error) {
			const ve = this.toVoiceError(error, "TTS_FAILURE");
			this.report(ve, "Speech synthesis failed");
			emitMetrics();
			return { ok: false, reason: ve.code, message: ve.message };
		}

		emitMetrics();
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

function now(): number {
	return Date.now();
}
