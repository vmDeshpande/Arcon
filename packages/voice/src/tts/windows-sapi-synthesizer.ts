import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VoiceError } from "../errors.js";
import { which } from "../util/exec.js";
import { writeTempFile, tryUnlink } from "../util/fs.js";

export interface WindowsSapiSynthesizerOptions {
	rate?: number;
	timeoutMs?: number;
	powershellPath?: string;
}

const SAPI_PSSCRIPT = [
	"$ErrorActionPreference = 'Stop'",
	"Add-Type -AssemblyName System.Speech -ErrorAction Stop",
	"$text = Get-Content -Raw -LiteralPath $args[0]",
	"$rate = [int] $args[1]",
	"try {",
	"  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
	"  $synth.Rate = $rate",
	"  $synth.Speak($text)",
	"} finally {",
	"  $synth.Dispose()",
	"}",
].join(";\n");

export class WindowsSapiSynthesizer {
	private readonly powershellPath: string;
	private readonly rate: number;
	private readonly timeoutMs: number;
	private scriptPath: string | null = null;
	private active: ChildProcess | null = null;

	constructor(options: WindowsSapiSynthesizerOptions = {}) {
		this.powershellPath = options.powershellPath ?? "powershell.exe";
		this.rate = options.rate ?? -2;
		this.timeoutMs = options.timeoutMs ?? 30000;
	}

	async isAvailable(): Promise<boolean> {
		if (process.platform !== "win32") {
			return false;
		}
		return (await which(this.powershellPath)) !== null;
	}

	private ensureScript(): string {
		if (this.scriptPath) {
			return this.scriptPath;
		}
		mkdirSync(tmpdir(), { recursive: true });
		this.scriptPath = join(tmpdir(), `arcon-voice-sapi-${process.pid}.ps1`);
		writeFileSync(this.scriptPath, SAPI_PSSCRIPT, "utf8");
		return this.scriptPath;
	}

	async speak(text: string, onFirstAudio?: () => void): Promise<void> {
		if (!(await this.isAvailable())) {
			throw new VoiceError("TTS_FAILURE", "Windows Speech API is not available on this platform");
		}

		const textPath = writeTempFile("txt", text);
		const script = this.ensureScript();

		const child = spawn(
			this.powershellPath,
			["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, textPath, String(this.rate)],
			{ stdio: ["ignore", "ignore", "pipe"] },
		);
		this.active = child;
		onFirstAudio?.();

		let stderr = "";
		child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				terminate(child);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Speech API playback timed out"));
			}, this.timeoutMs);

			child.on("error", (error) => {
				clearTimeout(timer);
				reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", "Failed to launch speech playback", error));
			});

			child.on("close", (code) => {
				clearTimeout(timer);
				tryUnlink(textPath);
				if (code === 0) {
					resolve();
				} else {
					const detail = stderr.trim() ? `: ${stderr.trim().slice(0, 200)}` : "";
					reject(new VoiceError("AUDIO_PLAYBACK_FAILURE", `Speech API playback failed (exit ${code})${detail}`));
				}
			});
		});

		this.active = null;
	}

	async stop(): Promise<void> {
		if (this.active) {
			terminate(this.active);
			this.active = null;
		}
	}
}

function terminate(child: ChildProcess): void {
	try {
		child.kill("SIGKILL");
	} catch {
		/* already dead */
	}
}
