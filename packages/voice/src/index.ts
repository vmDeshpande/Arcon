export { VoiceError, type VoiceErrorCode } from "./errors.js";
export type { Transcription, AudioRecording, AudioDevice, RecordOptions } from "./types.js";
export type {
	AudioRecorder,
	SpeechRecognizer,
	SpeechSynthesizer,
	ArconChat,
	VoiceServiceOptions,
	VoiceTurnResult,
	VoiceEventCallbacks,
} from "./interfaces.js";

export { FFmpegMicrophoneRecorder, type FFmpegMicrophoneRecorderOptions } from "./audio/ffmpeg-microphone-recorder.js";
export { WhisperSttRecognizer, type WhisperSttRecognizerOptions } from "./stt/whisper-stt-recognizer.js";
export { WindowsSapiSynthesizer, type WindowsSapiSynthesizerOptions } from "./tts/windows-sapi-synthesizer.js";
export { FfmpegFliteSynthesizer, type FfmpegFliteSynthesizerOptions } from "./tts/ffmpeg-flite-synthesizer.js";

export { SilenceDetector, type FrameResult, type SilenceDetectorOptions } from "./audio/silence.js";
export { encodeWav, rmsOfPcm16, durationOfPcm16 } from "./audio/wav.js";

export { VoiceService } from "./voice-service.js";
export { createLocalVoiceService, type CreateVoiceServiceOptions, type VoiceEnvironment } from "./factory.js";
