import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerConfig {
  port: number;
  inferenceBackend: "ollama" | "arcon-lora";
  ollamaBaseUrl: string;
  ollamaModel: string;
  arconInferenceBaseUrl: string;
  arconAdapterName: string;
  contextLimit: number;
  logsDir: string;
  memoryDatabasePath: string;
}

export function loadConfig(): ServerConfig {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const dataDir = process.env.ARCON_DATA_DIR
    ? resolve(process.env.ARCON_DATA_DIR)
    : resolve(repoRoot, "data");

  const inferenceBackend = (process.env.ARCON_INFERENCE_BACKEND as ServerConfig["inferenceBackend"]) ?? "arcon-lora";

  return {
    port: parseNumber(process.env.PORT, 3000),
    inferenceBackend,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
    arconInferenceBaseUrl: process.env.ARCON_INFERENCE_BASE_URL ?? "http://localhost:8000",
    arconAdapterName: process.env.ARCON_ADAPTER_NAME ?? "arcon-v1",
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
