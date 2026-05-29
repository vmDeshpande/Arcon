import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@arcon/shared";

export type LogLevel = "info" | "warn" | "error";

export interface FileLoggerOptions {
  logsDir: string;
}

export class FileLogger implements Logger {
  constructor(private readonly options: FileLoggerOptions) {
    mkdirSync(this.options.logsDir, { recursive: true });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write("error", message, metadata);
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      metadata: metadata ?? {}
    };
    const line = JSON.stringify(entry);
    const logFile = join(this.options.logsDir, `${timestamp.slice(0, 10)}.log`);

    appendFileSync(logFile, `${line}\n`, "utf8");

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.info(line);
  }
}

export function createLogger(logsDir: string): Logger {
  return new FileLogger({ logsDir });
}
