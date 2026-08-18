export interface FrameResult {
	speaking: boolean;
	hasSpeech: boolean;
	elapsedMs: number;
	silenceMs: number;
	shouldStop: boolean;
}

export interface SilenceDetectorOptions {
	threshold: number;
	leadInMs: number;
	silenceTimeoutMs: number;
	maxDurationMs: number;
	frameMs: number;
}

export class SilenceDetector {
	private readonly options: SilenceDetectorOptions;
	private elapsedMs = 0;
	private hasSpeech = false;
	private lastSpeechMs: number | null = null;

	constructor(options: Partial<SilenceDetectorOptions> = {}) {
		this.options = {
			threshold: options.threshold ?? 0.006,
			leadInMs: options.leadInMs ?? 300,
			silenceTimeoutMs: options.silenceTimeoutMs ?? 800,
			maxDurationMs: options.maxDurationMs ?? 15000,
			frameMs: options.frameMs ?? 20,
		};
	}

	feed(rms: number): FrameResult {
		const { threshold, silenceTimeoutMs, maxDurationMs, leadInMs, frameMs } = this.options;
		this.elapsedMs += frameMs;

		const speaking = rms > threshold;

		if (speaking) {
			this.hasSpeech = true;
			this.lastSpeechMs = this.elapsedMs;
		}

		const silenceMs =
			this.lastSpeechMs === null
				? this.elapsedMs
				: this.elapsedMs - this.lastSpeechMs;

		const pastLeadIn = this.elapsedMs >= leadInMs;
		const silenceTimeout = this.hasSpeech && silenceMs >= silenceTimeoutMs;
		const maxReached = this.elapsedMs >= maxDurationMs;

		const shouldStop = maxReached || (pastLeadIn && silenceTimeout);

		return {
			speaking,
			hasSpeech: this.hasSpeech,
			elapsedMs: this.elapsedMs,
			silenceMs,
			shouldStop,
		};
	}
}
