import { spawn, type ChildProcess } from "node:child_process";

import { VoiceError } from "../errors.js";
import { SilenceDetector } from "./silence.js";
import { encodeWav, rmsOfPcm16, durationOfPcm16 } from "./wav.js";
import { which } from "../util/exec.js";
import type { AudioDevice, AudioRecording, RecordOptions } from "../types.js";

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHANNELS = 1;
const FRAME_BYTES = 640; // 20ms of s16le mono @ 16kHz
const STARTUP_DEADLINE_MS = 2000;

export interface FFmpegMicrophoneRecorderOptions {
	ffmpegPath?: string;
}

export class FFmpegMicrophoneRecorder {
	private readonly ffmpegPath: string;
	private activeChild: ChildProcess | null = null;

	constructor(options: FFmpegMicrophoneRecorderOptions = {}) {
		this.ffmpegPath = options.ffmpegPath ?? "ffmpeg";
	}

	async isAvailable(): Promise<boolean> {
		return (await which(this.ffmpegPath)) !== null;
	}

	async listInputDevices(): Promise<AudioDevice[]> {
		await this.requireExecutable();

		const child = spawn(this.ffmpegPath, ["-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

		const code = await childClosed(child);
		if (code !== 0) {
			throw new VoiceError("MIC_UNAVAILABLE", `Failed to enumerate devices (ffmpeg exited ${code})`);
		}

		const devices: AudioDevice[] = [];
		let pendingName: string | null = null;
		let audioIndex = 0;

		const flushPending = () => {
			if (pendingName !== null) {
				devices.push({ name: pendingName, id: pendingName, default: audioIndex === 0 });
				audioIndex += 1;
				pendingName = null;
			}
		};

		for (const line of stderr.split(/\r?\n/)) {
			const trimmed = line.replace(/^\[[^\]]*\]\s*/, "");
			const match = trimmed.match(/^"(.+?)"\s*\((audio|video|none)\)/);
			if (match) {
				flushPending();
				if (match[2] === "audio") {
					pendingName = match[1];
				}
				continue;
			}
			const alt = trimmed.match(/Alternative name\s+"(.+?)"/);
			if (alt && pendingName !== null) {
				devices.push({ name: pendingName, id: alt[1], default: audioIndex === 0 });
				audioIndex += 1;
				pendingName = null;
			}
		}
		flushPending();

		return devices;
	}

	async record(options: RecordOptions): Promise<AudioRecording> {
		await this.requireExecutable();

		let devices = await this.listInputDevices();
		if (options.deviceId) {
			const wanted = options.deviceId;
			if (devices.some((d) => d.id === wanted)) {
				devices = devices.filter((d) => d.id === wanted);
			} else if (devices.some((d) => d.name === wanted)) {
				devices = devices.filter((d) => d.name === wanted);
			}
		}

		if (devices.length === 0) {
			throw new VoiceError("MIC_UNAVAILABLE", "No microphone input devices were found");
		}

		return new Promise<AudioRecording>((resolve, reject) => {
			const device = devices.find((d) => d.default) ?? devices[0];
			const maxDurationMs = (options.maxDurationSeconds ?? 15) * 1000;
			const detector = new SilenceDetector({
				threshold: options.energyThreshold ?? 0.006,
				leadInMs: options.leadInMs ?? 300,
				silenceTimeoutMs: options.silenceTimeoutMs ?? 800,
				maxDurationMs,
				frameMs: 20,
			});

			const args = [
				"-hide_banner",
				"-f", "dshow",
				"-i", `audio=${device.id}`,
				"-f", "s16le",
				"-ac", String(DEFAULT_CHANNELS),
				"-ar", String(DEFAULT_SAMPLE_RATE),
				"-",
			];

			const child = spawn(this.ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
			this.activeChild = child;

			let stderr = "";
			let gotData = false;
			let pending = Buffer.alloc(0);
			const frames: Buffer[] = [];
			let state = { speaking: false, hasSpeech: false, elapsedMs: 0, silenceMs: 0, shouldStop: false };
			let settled = false;
			let startupTimer: NodeJS.Timeout | null = null;

			const fail = (error: VoiceError) => {
				if (settled) {
					return;
				}
				settled = true;
				if (startupTimer) {
					clearTimeout(startupTimer);
				}
				terminate(child);
				this.activeChild = null;
				reject(error);
			};

			const finish = () => {
				if (settled) {
					return;
				}
				settled = true;
				if (startupTimer) {
					clearTimeout(startupTimer);
				}
				terminate(child, true);
				this.activeChild = null;

				const pcm = Buffer.concat(frames);
				if (pcm.length === 0 || !state.hasSpeech) {
					reject(new VoiceError("NO_SPEECH_DETECTED", "No speech was detected in the audio"));
					return;
				}

				const wav = encodeWav(pcm, DEFAULT_SAMPLE_RATE, DEFAULT_CHANNELS);
				resolve({
					wav,
					sampleRate: DEFAULT_SAMPLE_RATE,
					channels: DEFAULT_CHANNELS,
					durationSeconds: durationOfPcm16(pcm, DEFAULT_SAMPLE_RATE, DEFAULT_CHANNELS),
				});
			};

			startupTimer = setTimeout(() => {
				if (!gotData && !settled) {
					fail(new VoiceError("MIC_UNAVAILABLE", "Microphone did not produce audio in time"));
				}
			}, STARTUP_DEADLINE_MS);

			child.stderr.on("data", (d) => {
				stderr += d.toString("utf8");
			});

			child.stdout.on("data", (d: Buffer) => {
				gotData = true;
				if (startupTimer) {
					clearTimeout(startupTimer);
					startupTimer = null;
				}
				pending = Buffer.concat([pending, d]);
				frames.push(d);

				while (pending.length >= FRAME_BYTES) {
					const frame = pending.subarray(0, FRAME_BYTES);
					pending = pending.subarray(FRAME_BYTES);
					const rms = rmsOfPcm16(frame);
					state = detector.feed(rms);
					options.onProgress?.(rms, state.speaking);
					if (state.shouldStop) {
						finish();
						return;
					}
				}
			});

			child.on("close", () => {
				if (settled) {
					return;
				}
				if (!gotData) {
					fail(mapStartupError(stderr));
					return;
				}
				finish();
			});

			child.on("error", (error) => {
				fail(mapSpawnError(error));
			});
		});
	}

	async stop(): Promise<void> {
		if (this.activeChild) {
			terminate(this.activeChild);
			this.activeChild = null;
		}
	}

	private async requireExecutable(): Promise<void> {
		const path = await which(this.ffmpegPath);
		if (!path) {
			throw new VoiceError("MIC_UNAVAILABLE", `ffmpeg was not found on PATH (looked for ${this.ffmpegPath})`);
		}
	}
}

function childClosed(child: ChildProcess): Promise<number | null> {
	return new Promise((resolve) => {
		child.on("close", (code) => resolve(typeof code === "number" ? code : null));
	});
}

function terminate(child: ChildProcess, _drain = false): void {
	try {
		child.kill("SIGTERM");
	} catch {
		try {
			child.kill("SIGKILL");
		} catch {
			/* already dead */
		}
	}
}

function mapSpawnError(error: Error & { code?: string }): VoiceError {
	if (error.code === "ENOENT") {
		return new VoiceError("MIC_UNAVAILABLE", "Audio capture executable was not found", error);
	}
	return new VoiceError("MIC_UNAVAILABLE", "Failed to start audio capture", error);
}

function mapStartupError(stderr: string): VoiceError {
	if (/permission denied/i.test(stderr) || /access is denied/i.test(stderr)) {
		return new VoiceError("MIC_PERMISSION_DENIED", "Microphone access was denied");
	}
	if (/Could not find audio only device/i.test(stderr)) {
		return new VoiceError("MIC_UNAVAILABLE", "No microphone device matched");
	}
	return new VoiceError("MIC_UNAVAILABLE", "Microphone was unavailable");
}
