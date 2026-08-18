export interface Transcription {
	text: string;
	language: string | null;
	duration: number;
}

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
	onProgress?: (rms: number, speaking: boolean) => void;
}
