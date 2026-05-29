import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerConfig {
  port: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  contextLimit: number;
  logsDir: string;
  memoryDatabasePath: string;
}

export function loadConfig(): ServerConfig {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const dataDir = process.env.ARCON_DATA_DIR
    ? resolve(process.cwd(), process.env.ARCON_DATA_DIR)
    : resolve(repoRoot, "data");

  return {
    port: parseNumber(process.env.PORT, 3000),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
    contextLimit: parseNumber(process.env.ARCON_CONTEXT_LIMIT, 12),
    logsDir: resolve(dataDir, "logs"),
    memoryDatabasePath: resolve(dataDir, "memories", "conversation.sqlite")
  };
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
