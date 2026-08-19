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
	minSpeechMs: number;
}

export class SilenceDetector {
	private readonly options: SilenceDetectorOptions;
	private elapsedMs = 0;
	private hasSpeech = false;
	private lastSpeechMs: number | null = null;
	private ambientSum = 0;
	private ambientFrames = 0;
	private adaptiveThreshold: number | null = null;

	constructor(options: Partial<SilenceDetectorOptions> = {}) {
		this.options = {
			threshold: options.threshold ?? 0.006,
			leadInMs: options.leadInMs ?? 150,
			silenceTimeoutMs: options.silenceTimeoutMs ?? 300,
			maxDurationMs: options.maxDurationMs ?? 15000,
			frameMs: options.frameMs ?? 20,
			minSpeechMs: options.minSpeechMs ?? 400,
		};
	}

	feed(rms: number): FrameResult {
		const { threshold, silenceTimeoutMs, maxDurationMs, leadInMs, frameMs, minSpeechMs } = this.options;
		this.elapsedMs += frameMs;

		const pastLeadIn = this.elapsedMs >= leadInMs;

		if (this.adaptiveThreshold === null) {
			if (pastLeadIn) {
				this.adaptiveThreshold = this.computeAdaptiveThreshold();
			} else {
				this.ambientSum += rms;
				this.ambientFrames += 1;
			}
		}

		const effectiveThreshold = this.adaptiveThreshold ?? threshold;
		const speaking = rms > effectiveThreshold;

		if (speaking) {
			this.hasSpeech = true;
			this.lastSpeechMs = this.elapsedMs;
		}

		const silenceMs =
			this.lastSpeechMs === null
				? this.elapsedMs
				: this.elapsedMs - this.lastSpeechMs;

		const silenceTimeout = this.hasSpeech && silenceMs >= silenceTimeoutMs;
		const maxReached = this.elapsedMs >= maxDurationMs;
		const pastMinSpeech = this.elapsedMs >= minSpeechMs;

		const shouldStop = maxReached || (pastLeadIn && pastMinSpeech && silenceTimeout);

		return {
			speaking,
			hasSpeech: this.hasSpeech,
			elapsedMs: this.elapsedMs,
			silenceMs,
			shouldStop,
		};
	}

	private computeAdaptiveThreshold(): number {
		if (this.ambientFrames === 0) {
			return this.options.threshold;
		}

		const avgAmbient = this.ambientSum / this.ambientFrames;
		const base = this.options.threshold;
		const dynamic = avgAmbient * 2.5;

		return Math.max(base, dynamic);
	}
}
