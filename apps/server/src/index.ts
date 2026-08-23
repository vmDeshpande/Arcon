import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOllamaClient, createArconLoRAProvider, type ArconLoRAProviderOptions, type OllamaClientOptions } from "@arcon/ai";
import { createLogger } from "@arcon/logger";
import { createConversationMemory, MemoryRepository, MemoryPipeline } from "@arcon/memory";
import { EventBus } from "@arcon/shared";
import { createApp, type CreateAppOptions } from "./app.js";
import { loadConfig } from "./config.js";
import { registerEventLogging } from "./events.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

const config = loadConfig();
const logger = createLogger(config.logsDir);
const eventBus = new EventBus();
const memory = createConversationMemory(config.memoryDatabasePath);

let aiClient: import("@arcon/shared").AiClient;

if (config.inferenceBackend === "arcon-lora") {
  const options: ArconLoRAProviderOptions = {
    baseUrl: config.arconInferenceBaseUrl,
    model: config.arconAdapterName,
    timeoutMs: 120_000,
  };

  aiClient = createArconLoRAProvider(options);
} else {
  const options: OllamaClientOptions = {
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
  };

  aiClient = createOllamaClient(options);
}

registerEventLogging(eventBus, logger);

const memoriesDir = dirname(config.memoryDatabasePath);

const app = createApp({
  aiClient,
  memory,
  eventBus,
  contextLimit: config.contextLimit,
  inferenceBackend: config.inferenceBackend,
  ollamaModel: config.ollamaModel,
  arconInferenceBaseUrl: config.arconInferenceBaseUrl,
  arconAdapterName: config.arconAdapterName,
  chatServiceOptions: {
    experienceDatabasePath: resolve(memoriesDir, "..", "experiences.sqlite"),
    moodDatabasePath: resolve(memoriesDir, "..", "mood.sqlite"),
    entityDatabasePath: resolve(memoriesDir, "..", "entities.sqlite"),
    conversationDatabasePath: config.memoryDatabasePath,
  },
  memoryDatabasePath: config.memoryDatabasePath,
});

app.listen(config.port, () => {
  logger.info("Arcon server started", {
    port: config.port,
    inferenceBackend: config.inferenceBackend,
    ...(config.inferenceBackend === "ollama"
      ? { ollamaBaseUrl: config.ollamaBaseUrl, ollamaModel: config.ollamaModel }
      : { arconInferenceBaseUrl: config.arconInferenceBaseUrl, arconAdapterName: config.arconAdapterName }),
  });
});
