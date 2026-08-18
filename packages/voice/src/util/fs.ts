import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function writeTempFile(extension: string, contents: Buffer | string): string {
	mkdirSync(tmpdir(), { recursive: true });
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const path = join(tmpdir(), `arcon-voice-${suffix}.${extension}`);
	writeFileSync(path, contents);
	return path;
}

export function makeTempPath(extension: string): string {
	mkdirSync(tmpdir(), { recursive: true });
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return join(tmpdir(), `arcon-voice-${suffix}.${extension}`);
}

export function tryUnlink(path: string): void {
	if (existsSync(path)) {
		try {
			unlinkSync(path);
		} catch {
			/* ignore */
		}
	}
}
