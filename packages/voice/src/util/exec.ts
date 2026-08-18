import { spawn } from "node:child_process";

export function which(cmd: string, timeoutMs = 5000): Promise<string | null> {
	return new Promise((resolve) => {
		const child = spawn("cmd", ["/c", "where", cmd], { stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		child.stdout.on("data", (d) => (out += d.toString()));
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			resolve(null);
		}, timeoutMs);
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve(code === 0 && out.trim() ? out.trim().split(/\s+/)[0] : null);
		});
		child.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}

export function spawnExe(
	command: string,
	args: string[],
	options: { timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => (stdout += d.toString()));
		child.stderr.on("data", (d) => (stderr += d.toString()));
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			resolve({ stdout, stderr, code: null });
		}, options.timeoutMs ?? 15000);
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ stdout, stderr, code: typeof code === "number" ? code : null });
		});
		child.on("error", () => {
			clearTimeout(timer);
			resolve({ stdout, stderr, code: null });
		});
	});
}
