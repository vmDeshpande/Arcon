export type VoiceErrorCode =
	| "MIC_UNAVAILABLE"
	| "MIC_PERMISSION_DENIED"
	| "NO_SPEECH_DETECTED"
	| "STT_FAILURE"
	| "STT_MODEL_UNAVAILABLE"
	| "TTS_FAILURE"
	| "AUDIO_PLAYBACK_FAILURE"
	| "CHAT_FAILURE"
	| "INITIALIZATION_FAILED";

export class VoiceError extends Error {
	readonly name = "VoiceError";

	constructor(
		public readonly code: VoiceErrorCode,
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);

		if (cause instanceof Error && cause.message) {
			this.message = `${message}: ${cause.message}`;
		}
	}
}
