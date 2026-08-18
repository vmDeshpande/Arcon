import { spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as readline from "node:readline";
import { mkdtempSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VoiceError } from "../errors.js";
import type { AudioRecording, Transcription } from "../types.js";

const STT_WORKER_SCRIPT = `#!/usr/bin/env python
import sys
import os
import json
import logging

logging.disable(logging.CRITICAL)


def run():
    model_name = sys.argv[1] if len(sys.argv) > 1 else "tiny"
    threads = int(sys.argv[2]) if len(sys.argv) > 2 else (os.cpu_count() or 4)

    from faster_whisper import WhisperModel

    model = WhisperModel(
        model_name,
        device="cpu",
        cpu_threads=threads,
        compute_type="int8",
    )

    sys.stdout.write('{"event":"ready"}\\n')
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            path = request.get("path", "")
        except Exception:
            path = line
        if not path:
            continue
        try:
            segments, info = model.transcribe(path, beam_size=1, vad_filter=False)
            text = " ".join(s.text for s in segments).strip()
            out = {
                "text": text,
                "language": info.language,
                "duration": round(info.duration, 2),
                "error": None,
            }
        except Exception as exc:
            out = {
                "text": "",
                "language": None,
                "duration": 0.0,
                "error": str(exc),
            }
        sys.stdout.write(json.dumps(out) + "\\n")
        sys.stdout.flush()


run()
`;

export interface WhisperSttRecognizerOptions {
	pythonPath?: string;
	model?: string;
	cpuThreads?: number;
	readyTimeoutMs?: number;
}

export class WhisperSttRecognizer {
	private readonly pythonPath: string;
	private readonly model: string;
	private readonly cpuThreads: number;
	private readonly readyTimeoutMs: number;
	private worker: ChildProcessWithoutNullStreams | null = null;
	private rl: readline.Interface | null = null;
	private workerReady = false;
	private workerDir: string | null = null;
	private workerScriptPath: string | null = null;
	private spawnError: Error | null = null;

	constructor(options: WhisperSttRecognizerOptions = {}) {
		this.pythonPath = options.pythonPath ?? "python";
		this.model = options.model ?? "tiny";
		this.cpuThreads = options.cpuThreads ?? 4;
		this.readyTimeoutMs = options.readyTimeoutMs ?? 120000;
	}

	async isAvailable(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const child = spawn(this.pythonPath, ["-c", "import faster_whisper"], {
				stdio: ["ignore", "pipe", "pipe"],
			});
			child.on("close", (code) => resolve(code === 0));
			child.on("error", () => resolve(false));
		});
	}

	async start(): Promise<void> {
		if (this.worker && this.workerReady) {
			return;
		}
		await this.launchWorker();
	}

	async stop(): Promise<void> {
		if (this.rl) {
			this.rl.removeAllListeners();
			this.rl = null;
		}
		if (this.worker) {
			try {
				this.worker.kill("SIGKILL");
			} catch {
				/* already gone */
			}
			this.worker = null;
		}
		this.workerReady = false;
		this.cleanupWorkerFiles();
	}

	private async launchWorker(): Promise<void> {
		this.workerDir = mkdtempSync(join(tmpdir(), "arcon-voice-stt-"));
		this.workerScriptPath = join(this.workerDir, "stt_worker.py");
		writeFileSync(this.workerScriptPath, STT_WORKER_SCRIPT, "utf8");

		const child = spawn(this.pythonPath, [this.workerScriptPath, this.model, String(this.cpuThreads)], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.worker = child;
		this.workerReady = false;
		this.spawnError = null;
		this.rl = readline.createInterface({ input: child.stdout, terminal: false });

		child.on("error", (error) => {
			this.spawnError = error;
			this.workerReady = false;
		});

		const timeout = setTimeout(() => {
			terminate(child);
		}, this.readyTimeoutMs);

		let line: string;
		try {
			line = await this.readLine();
		} finally {
			clearTimeout(timeout);
		}

		if (line === "") {
			throw new VoiceError(
				"STT_FAILURE",
				this.spawnError ? "Failed to start speech recognition" : "Speech recognition worker exited before becoming ready",
				this.spawnError ?? undefined,
			);
		}

		const payload = tryParseJson(line);
		if (!payload || payload.event !== "ready") {
			throw new VoiceError("STT_FAILURE", `Unexpected worker startup response: ${line}`);
		}

		this.workerReady = true;
	}

	async transcribe(recording: AudioRecording): Promise<Transcription> {
		if (!this.worker || !this.workerReady) {
			await this.start();
		}

		try {
			return await this.doTranscribe(recording);
		} catch (error) {
			if (error instanceof VoiceError && error.code === "STT_FAILURE" && this.isWorkerDead()) {
				await this.start();
				return this.doTranscribe(recording);
			}
			throw error instanceof VoiceError ? error : new VoiceError("STT_FAILURE", "Speech recognition failed", error);
		}
	}

	private async doTranscribe(recording: AudioRecording): Promise<Transcription> {
		if (!this.worker || !this.workerReady) {
			await this.start();
		}

		const wavPath = writeTempWav(recording.wav);
		const request = JSON.stringify({ path: wavPath });

		try {
			const stdin = this.worker?.stdin;
			if (!stdin || stdin.destroyed) {
				throw new VoiceError("STT_FAILURE", "Speech recognition worker stdin is unavailable");
			}
			stdin.write(request + "\n");

			const line = await this.readWithTimeout(30000);
			const payload = tryParseJson(line);

			if (!payload) {
				throw new VoiceError("STT_FAILURE", `Malformed recognition response: ${line}`);
			}

			const error = payload.error;
			if (error) {
				throw new VoiceError("STT_FAILURE", typeof error === "string" ? error : "recognition failed");
			}

			const text = payload.text;
			if (typeof text !== "string") {
				throw new VoiceError("STT_FAILURE", "Recognition response was missing text");
			}

			const language = payload.language;
			const duration = payload.duration;

			return {
				text: text.trim(),
				language: typeof language === "string" ? language : null,
				duration: typeof duration === "number" ? duration : 0,
			};
		} finally {
			try {
				unlinkSync(wavPath);
			} catch {
				/* ignore */
			}
		}
	}

	private readLine(): Promise<string> {
		return new Promise<string>((resolve) => {
			if (!this.rl) {
				resolve("");
				return;
			}

			const onLine = (line: string) => finish(line);
			const onClose = () => finish("");
			let settled = false;

			const finish = (value: string) => {
				if (settled) {
					return;
				}
				settled = true;
				this.rl?.removeListener("line", onLine);
				this.rl?.removeListener("close", onClose);
				if (this.worker) {
					this.worker.removeListener("error", onError);
				}
				resolve(value);
			};

			const onError = () => {
				finish("");
			};

			this.rl.once("line", onLine);
			this.rl.once("close", onClose);
			if (this.worker) {
				this.worker.prependOnceListener("error", onError);
			}
		});
	}

	private readWithTimeout(ms: number): Promise<string> {
		return new Promise<string>((resolve) => {
			const timer = setTimeout(() => resolve(""), ms);
			this.readLine().then((line) => {
				clearTimeout(timer);
				resolve(line);
			});
		});
	}

	private isWorkerDead(): boolean {
		return this.worker === null || this.worker.killed || this.worker.exitCode !== null;
	}

	private cleanupWorkerFiles(): void {
		if (this.workerScriptPath && existsSync(this.workerScriptPath)) {
			try {
				unlinkSync(this.workerScriptPath);
			} catch {
				/* ignore */
			}
		}
		if (this.workerDir && existsSync(this.workerDir)) {
			try {
				unlinkSync(this.workerDir);
			} catch {
				/* ignore */
			}
		}
		this.workerScriptPath = null;
		this.workerDir = null;
	}
}

function writeTempWav(wav: Buffer): string {
	const path = join(tmpdir(), `arcon-voice-rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);
	writeFileSync(path, wav);
	return path;
}

function tryParseJson(line: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(line);
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function terminate(child: ChildProcess): void {
	try {
		child.kill("SIGKILL");
	} catch {
		/* already dead */
	}
}
