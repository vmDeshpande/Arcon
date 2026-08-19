import { spawn, type ChildProcess } from "node:child_process";

import { VoiceError } from "../errors.js";
import { which, spawnExe } from "../util/exec.js";
import { makeTempPath, tryUnlink } from "../util/fs.js";

export interface FfmpegFliteSynthesizerOptions {
	ffmpegPath?: string;
	ffplayPath?: string;
	rate?: number;
	timeoutMs?: number;
}

export class FfmpegFliteSynthesizer {
	private readonly ffmpegPath: string;
	private readonly ffplayPath: string;
	private readonly timeoutMs: number;
	private active: ChildProcess | null = null;

	constructor(options: FfmpegFliteSynthesizerOptions = {}) {
		this.ffmpegPath = options.ffmpegPath ?? "ffmpeg";
		this.ffplayPath = options.ffplayPath ?? "ffplay";
		this.timeoutMs = options.timeoutMs ?? 30000;
	}

	async isAvailable(): Promise<boolean> {
		const [ffmpeg, ffplay] = await Promise.all([which(this.ffmpegPath), which(this.ffplayPath)]);
		if (!ffmpeg || !ffplay) {
			return false;
		}
		const { stdout } = await spawnExe(ffmpeg, ["-hide_banner", "-filters"], { timeoutMs: 5000 });
		return /[\s\ns]flite\s/.test(stdout);
	}

	async speak(text: string, onFirstAudio?: () => void): Promise<void> {
		const wavPath = makeTempPath("wav");
		const filtergraph = `flite=text=${escapeFiltergraphValue(text)}`;

		const gen = spawn(this.ffmpegPath, ["-hide_banner", "-y", "-f", "lavfi", "-i", filtergraph, "-ar", "16000", "-ac", "1", wavPath], {
			stdio: ["ignore", "ignore", "pipe"],
		});

		let stderr = "";
		gen.stderr.on("data", (d) => (stderr += d.toString("utf8")));

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				terminate(gen);
				reject(new VoiceError("TTS_FAILURE", "Flite synthesis timed out"));
			}, this.timeoutMs);
			gen.on("error", (error) => {
				clearTimeout(timer);
				reject(new VoiceError("TTS_FAILURE", "Failed to start synthesis", error));
			});
			gen.on("close", (code) => {
				clearTimeout(timer);
				if (code === 0) {
					resolve();
				} else {
					reject(new VoiceError("TTS_FAILURE", `Flite synthesis failed (exit ${code})`, undefined));
				}
			});
		});

		this.active = spawn(this.ffplayPath, ["-nodisp", "-autoexit", "-loglevel", "quiet", "-i", wavPath], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		onFirstAudio?.();

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				terminate(this.active!);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Audio playback timed out"));
			}, this.timeoutMs);
			this.active!.on("error", (error) => {
				clearTimeout(timer);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Failed to start audio playback", error));
			});
			this.active!.on("close", (code) => {
				clearTimeout(timer);
				if (code === 0 || code === 1) {
					resolve();
				} else {
					reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", `Audio playback failed (exit ${code})`));
				}
			});
		});
	}

	async stop(): Promise<void> {
		if (this.active) {
			terminate(this.active);
			this.active = null;
		}
	}
}

function escapeFiltergraphValue(text: string): string {
	const escaped = text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	return `'${escaped}'`;
}

function terminate(child: ChildProcess): void {
	try {
		child.kill("SIGKILL");
	} catch {
		/* already dead */
	}
}
