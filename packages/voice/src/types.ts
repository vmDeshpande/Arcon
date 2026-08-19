export interface Transcription {
  text: string;
  language: string | null;
  duration: number;
}

export type SynthChunk =
	| { type: "token"; text: string }
	| { type: "done" }
	| { type: "error"; message: string };

export interface AudioRecording {
	readonly wav: Buffer;
	readonly sampleRate: number;
	readonly channels: number;
	readonly durationSeconds: number;
}

export interface AudioDevice {
	readonly id: string;
	readonly name: string;
	readonly default: boolean;
}

export interface RecordOptions {
  deviceId?: string;
  maxDurationSeconds?: number;
  silenceTimeoutMs?: number;
  energyThreshold?: number;
  leadInMs?: number;
  minSpeechMs?: number;
  onProgress?: (rms: number, speaking: boolean) => void;
}
