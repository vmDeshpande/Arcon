import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VoiceError } from "../errors.js";
import { which } from "../util/exec.js";
import { tryUnlink } from "../util/fs.js";
import { SentenceBuffer } from "../audio/sentence-buffer.js";
import type { SynthChunk } from "../types.js";

const PIPER_WORKER_SCRIPT = `#!/usr/bin/env python
import sys, os, json, time, wave

def run():
    model_name = sys.argv[1]
    model_dir = sys.argv[2]
    try:
        os.makedirs(model_dir, exist_ok=True)
    except Exception:
        pass
    try:
        from piper import PiperVoice
        from huggingface_hub import hf_hub_download
        onnx = hf_hub_download(
            repo_id="rhasspy/piper-voices",
            filename=model_name + ".onnx",
            cache_dir=model_dir,
        )
        cfg = hf_hub_download(
            repo_id="rhasspy/piper-voices",
            filename=model_name + ".onnx.json",
            cache_dir=model_dir,
        )
        voice = PiperVoice.load(onnx, cfg)
    except Exception as exc:
        sys.stderr.write("PIPER_INIT_FAIL: " + str(exc) + "\\n")
        sys.stderr.flush()
        sys.exit(1)

    sys.stdout.write('{"event":"ready"}\\n')
    sys.stdout.flush()

    tdir = os.environ.get("TEMP", os.environ.get("TMP", "/tmp"))
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            text = req.get("text", "")
        except Exception:
            text = line

        wav_path = os.path.join(
            tdir, "arcon-piper-%d-%d.wav" % (os.getpid(), int(time.time() * 1000))
        )
        try:
            with wave.open(wav_path, "wb") as f:
                voice.synthesize_wav(text, wav_file=f)
            with wave.open(wav_path, "rb") as f:
                dur = f.getnframes() / float(f.getframerate())
            out = {"ok": True, "path": wav_path, "duration": round(dur, 3)}
            sys.stdout.write(json.dumps(out) + "\\n")
            sys.stdout.flush()
        except Exception as exc:
            try:
                os.unlink(wav_path)
            except Exception:
                pass
            sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}) + "\\n")
            sys.stdout.flush()

run()
`;

export interface PiperTtsSynthesizerOptions {
	pythonPath?: string;
	model?: string;
	modelDir?: string;
	ffplayPath?: string;
	timeoutMs?: number;
	readyTimeoutMs?: number;
}

export class PiperTtsSynthesizer {
	static readonly DEFAULT_MODEL = "en/en_US/amy/medium/en_US-amy-medium";

	private readonly pythonPath: string;
	private readonly model: string;
	private readonly modelDir: string;
	private readonly ffplayPath: string;
	private readonly timeoutMs: number;
	private readonly readyTimeoutMs: number;
	private readonly workerScriptPath: string | null;
	private worker: ChildProcessWithoutNullStreams | null = null;
	private ready = false;
	private readonly tempPaths = new Set<string>();

	constructor(options: PiperTtsSynthesizerOptions = {}) {
		this.pythonPath = options.pythonPath ?? "python";
		this.model = options.model ?? PiperTtsSynthesizer.DEFAULT_MODEL;
		this.modelDir = options.modelDir ?? join(tmpdir(), "arcon-voice-piper-models");
		this.ffplayPath = options.ffplayPath ?? "ffplay";
		this.timeoutMs = options.timeoutMs ?? 30000;
		this.readyTimeoutMs = options.readyTimeoutMs ?? 120000;
		this.workerScriptPath = writeWorkerScript();
	}

	async isAvailable(): Promise<boolean> {
		const [py, fp, piper] = await Promise.all([
			which(this.pythonPath),
			which(this.ffplayPath),
			canImportPiper(this.pythonPath),
		]);
		return py !== null && fp !== null && piper;
	}

	async prepare(): Promise<void> {
		if (this.worker && this.ready) {
			return;
		}
		await this.launchWorker();
	}

	async speak(text: string, onFirstAudio?: () => void): Promise<void> {
		if (!text) {
			return;
		}

		if (!this.worker || !this.ready) {
			await this.prepare();
		}

		if (!this.worker || !this.ready) {
			throw new VoiceError("TTS_FAILURE", "Piper TTS worker is not ready");
		}

		const wavPath = await this.synthesizeToWav(text);
		this.tempPaths.add(wavPath);

		try {
			await this.playWav(wavPath, onFirstAudio);
		} finally {
			tryUnlink(wavPath);
			this.tempPaths.delete(wavPath);
		}
	}

	async speakStream(chunks: AsyncIterable<SynthChunk>, onFirstAudio?: () => void): Promise<void> {
		if (!this.worker || !this.ready) {
			await this.prepare();
		}

		if (!this.worker || !this.ready) {
			throw new VoiceError("TTS_FAILURE", "Piper TTS worker is not ready");
		}

		const sentenceBuffer = new SentenceBuffer();
		const playbackQueue: { path: string; duration: number }[] = [];
		let firstAudioCalled = false;
		let playbackError: VoiceError | null = null;

		let playbackResolver: (() => void) | null = null;
		let playbackRejecter: ((err: VoiceError) => void) | null = null;
		let playbackRunning = false;

		const playNext = async (): Promise<void> => {
			while (playbackQueue.length > 0) {
				const item = playbackQueue.shift()!;
				try {
					await this.playWavQueued(item.path);
				} catch (error) {
					if (error instanceof VoiceError) {
						playbackError = error;
					} else {
						playbackError = new VoiceError("AUDIO_PLAYBACK_FAILURE", "Audio playback failed", error);
					}
					break;
				} finally {
					tryUnlink(item.path);
					this.tempPaths.delete(item.path);
				}
			}
			playbackRunning = false;
			if (playbackResolver) {
				playbackResolver();
				playbackResolver = null;
				playbackRejecter = null;
			}
		};

		const enqueuePlayback = (wavPath: string): void => {
			this.tempPaths.add(wavPath);
			if (!firstAudioCalled) {
				firstAudioCalled = true;
				onFirstAudio?.();
			}
			playbackQueue.push({ path: wavPath, duration: 0 });
			if (!playbackRunning) {
				playbackRunning = true;
				playNext().catch(() => {});
			}
		};

		try {
			for await (const chunk of chunks) {
				if (chunk.type === "error") {
					throw new VoiceError("CHAT_FAILURE", chunk.message);
				}
				if (chunk.type === "done") {
					break;
				}

				const sentences = sentenceBuffer.append(chunk.text);
				for (const sentence of sentences) {
					if (sentence.trim()) {
						const wavPath = await this.synthesizeToWav(sentence);
						this.tempPaths.add(wavPath);
						enqueuePlayback(wavPath);
					}
				}
			}

			// Flush remaining buffered text
			const remaining = sentenceBuffer.flush();
			if (remaining) {
				const wavPath = await this.synthesizeToWav(remaining);
				this.tempPaths.add(wavPath);
				enqueuePlayback(wavPath);
			}

			// Wait for all playback to finish
			await new Promise<void>((resolve, reject) => {
				playbackResolver = resolve;
				playbackRejecter = reject;
			});

			if (playbackError) {
				throw playbackError;
			}
		} catch (error) {
			if (error instanceof VoiceError) {
				throw error;
			}
			throw new VoiceError("TTS_FAILURE", "Streaming synthesis failed", error);
		}
	}

	private async synthesizeToWav(text: string): Promise<string> {
		const stdin = this.worker?.stdin;
		if (!stdin || stdin.destroyed) {
			throw new VoiceError("TTS_FAILURE", "Piper TTS worker stdin is unavailable");
		}

		stdin.write(JSON.stringify({ text }) + "\n");

		const line = await readLine(this.worker!, this.timeoutMs);
		const payload = safeParseJson(line);
		if (!payload) {
			throw new VoiceError("TTS_FAILURE", `Malformed Piper response: ${line}`);
		}

		if (payload.ok !== true) {
			const err = payload.error;
			throw new VoiceError(
				"TTS_FAILURE",
				typeof err === "string" ? err : err ? String(err) : "Piper synthesis failed",
			);
		}

		const wavPath = payload.path;
		if (typeof wavPath !== "string" || !existsSync(wavPath)) {
			throw new VoiceError("AUDIO_PLAYBACK_FAILURE", "Piper did not produce an audio file");
		}

		return wavPath;
	}

	private playWavQueued(wavPath: string): Promise<void> {
		const child = spawn(this.ffplayPath, ["-nodisp", "-autoexit", "-loglevel", "quiet", "-i", wavPath], {
			stdio: ["ignore", "ignore", "pipe"],
		});

		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				terminate(child);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Audio playback timed out"));
			}, this.timeoutMs);

			child.on("error", (error) => {
				clearTimeout(timer);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Failed to start audio playback", error));
			});

			child.on("close", (code) => {
				clearTimeout(timer);
				if (code === 0 || code === 1) {
					resolve();
				} else {
					reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", `Audio playback failed (exit ${code})`));
				}
			});
		});
	}

	private async playWav(wavPath: string, onFirstAudio?: () => void): Promise<void> {
		const child = spawn(this.ffplayPath, ["-nodisp", "-autoexit", "-loglevel", "quiet", "-i", wavPath], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		onFirstAudio?.();

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				terminate(child);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Piper audio playback timed out"));
			}, this.timeoutMs);

			child.on("error", (error) => {
				clearTimeout(timer);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Failed to start audio playback", error));
			});

			child.on("close", (code) => {
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
		this.closeStdin();

		if (this.worker) {
			try {
				this.worker.kill("SIGKILL");
			} catch {
				/* already gone */
			}
			this.worker = null;
		}

		this.ready = false;

		for (const p of this.tempPaths) {
			tryUnlink(p);
		}
		this.tempPaths.clear();

		if (this.workerScriptPath && existsSync(this.workerScriptPath)) {
			tryUnlink(this.workerScriptPath);
		}
	}

	private async launchWorker(): Promise<void> {
		if (!this.workerScriptPath) {
			throw new VoiceError("TTS_FAILURE", "Piper worker script was not written");
		}

		const child = spawn(this.pythonPath, [this.workerScriptPath, this.model, this.modelDir], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.worker = child;
		this.ready = false;

		let stderr = "";
		child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

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
				"TTS_FAILURE",
				`Piper TTS worker exited before becoming ready\n${stderr.slice(0, 300)}`,
			);
		}

		const payload = safeParseJson(line);
		if (!payload || payload.event !== "ready") {
			throw new VoiceError("TTS_FAILURE", `Unexpected Piper startup response: ${line}`);
		}

		this.ready = true;
	}

	private readLine(): Promise<string> {
		return new Promise<string>((resolve) => {
			if (!this.worker || !this.worker.stdout) {
				resolve("");
				return;
			}

			const stream = this.worker.stdout;
			let buf = "";
			let done = false;

			const finish = (value: string) => {
				if (done) {
					return;
				}
				done = true;
				stream.removeListener("data", onData);
				stream.removeListener("end", onEnd);
				resolve(value);
			};

			const onData = (chunk: Buffer) => {
				buf += chunk.toString("utf8");
				const idx = buf.indexOf("\n");
				if (idx !== -1) {
					finish(buf.slice(0, idx).trim());
				}
			};

			const onEnd = () => finish(buf ? buf.trim() : "");
			const onError = () => finish("");

			stream.once("data", onData);
			stream.once("end", onEnd);
			this.worker.once("error", onError);
		});
	}

	private closeStdin(): void {
		if (this.worker && this.worker.stdin) {
			try {
				this.worker.stdin.end();
			} catch {
				/* already closed */
			}
		}
	}
}

function writeWorkerScript(): string {
	try {
		mkdirSync(tmpdir(), { recursive: true });
	} catch {
		/* already exists */
	}

	const path = join(tmpdir(), `arcon-voice-piper-${process.pid}.py`);
	writeFileSync(path, PIPER_WORKER_SCRIPT, "utf8");
	return path;
}

async function canImportPiper(pythonPath: string): Promise<boolean> {
	const py = await which(pythonPath);
	if (!py) {
		return false;
	}
	return new Promise<boolean>((resolve) => {
		const child = spawn(py, ["-c", "import piper, huggingface_hub"], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		child.on("close", (code) => resolve(code === 0));
		child.on("error", () => resolve(false));
	});
}

function readLine(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<string> {
	return new Promise<string>((resolve) => {
		if (!child.stdout) {
			resolve("");
			return;
		}

		const timer = setTimeout(() => {
			if (!done) {
				done = true;
				resolve("");
			}
		}, timeoutMs);

		let buf = "";
		let done = false;

		const finish = (value: string) => {
			if (done) {
				return;
			}
			done = true;
			clearTimeout(timer);
			child.stdout.removeListener("data", onData);
			child.stdout.removeListener("end", onEnd);
			resolve(value);
		};

		const onData = (chunk: Buffer) => {
			buf += chunk.toString("utf8");
			const idx = buf.indexOf("\n");
			if (idx !== -1) {
				finish(buf.slice(0, idx).trim());
			}
		};

		const onEnd = () => finish(buf ? buf.trim() : "");
		const onError = () => finish("");

		child.stdout.once("data", onData);
		child.stdout.once("end", onEnd);
		child.once("error", onError);
	});
}

function safeParseJson(line: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(line);
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function terminate(child: { kill: (sig: NodeJS.Signals) => boolean }): void {
	try {
		child.kill("SIGKILL");
	} catch {
		/* already dead */
	}
}
