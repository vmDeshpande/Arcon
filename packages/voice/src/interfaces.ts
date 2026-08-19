import type { Logger } from "@arcon/shared";
import type { AudioDevice, AudioRecording, RecordOptions, Transcription, SynthChunk } from "./types.js";
import type { VoiceError } from "./errors.js";

export interface AudioRecorder {
	isAvailable(): Promise<boolean>;
	listInputDevices(): Promise<AudioDevice[]>;
	record(options: RecordOptions): Promise<AudioRecording>;
	stop(): Promise<void>;
}

export interface SpeechRecognizer {
	start(): Promise<void>;
	stop(): Promise<void>;
	isAvailable(): Promise<boolean>;
	transcribe(recording: AudioRecording): Promise<Transcription>;
}

export interface SpeechSynthesizer {
  isAvailable(): Promise<boolean>;
  prepare?(): Promise<void>;
  speak(text: string, onFirstAudio?: () => void): Promise<void>;
  speakStream?(chunks: AsyncIterable<SynthChunk>, onFirstAudio?: () => void): Promise<void>;
  stop(): Promise<void>;
}

export interface ArconChat {
  chat(message: string): Promise<{ reply: string }>;
  chatStream?(message: string): AsyncIterable<string>;
  close(): void;
}

export type VoiceTurnResult =
	| { ok: true; transcript: string; reply: string }
	| { ok: false; reason: VoiceError["code"]; message: string };

export interface VoiceEventCallbacks {
	onListening?: () => void;
	onRecordingStarted?: () => void;
	onRecordingEnded?: () => void;
	onTranscript?: (transcript: Transcription) => void;
	onReply?: (reply: string) => void;
	onSynthesizing?: () => void;
	onSilence?: () => void;
	onError?: (error: VoiceError) => void;
	onTurnMetrics?: (metrics: VoiceTurnMetrics) => void;
}

export interface VoiceTurnMetrics {
  recordMs: number;
  sttMs: number;
  chatMs: number;
  ttsMs: number;
  timeToFirstAudioMs: number;
  totalTurnMs: number;
  llmFirstTokenMs?: number;
}

export interface VoiceServiceOptions {
	recorder: AudioRecorder;
	recognizer: SpeechRecognizer;
	synthesizer: SpeechSynthesizer;
	chat: ArconChat;
	recordOptions?: Partial<RecordOptions>;
	logger?: Logger;
	events?: VoiceEventCallbacks;
}

export { VoiceError };
