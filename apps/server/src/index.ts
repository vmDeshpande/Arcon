import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOllamaClient, createArconLoRAProvider, type ArconLoRAProviderOptions, type OllamaClientOptions, type RuntimeIdentity, type RuntimeCapabilities, DEFAULT_RUNTIME_IDENTITY, buildRuntimeCapabilities } from "@arcon/ai";
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
let runtimeIdentity: RuntimeIdentity;

  if (config.inferenceBackend === "arcon-lora") {
    const options: ArconLoRAProviderOptions = {
      baseUrl: config.arconInferenceBaseUrl,
      model: config.arconAdapterName,
      timeoutMs: 300_000,
    };

    const provider = createArconLoRAProvider(options);
    aiClient = provider;

    try {
      runtimeIdentity = await provider.getRuntimeIdentity();
    } catch {
      runtimeIdentity = {
        ...DEFAULT_RUNTIME_IDENTITY,
        baseModel: "Qwen/Qwen3-4B",
        adapterName: config.arconAdapterName,
        inferenceBackend: "arcon-lora",
      };
    }
  } else {
  const options: OllamaClientOptions = {
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
  };

  aiClient = createOllamaClient(options);

  runtimeIdentity = {
    ...DEFAULT_RUNTIME_IDENTITY,
    baseModel: config.ollamaModel,
    adapterName: "none",
    inferenceBackend: "ollama",
  };
}

const runtimeCapabilities = buildRuntimeCapabilities({
  identity: runtimeIdentity,
  hasPersistentMemory: true,
  hasConversationPersistence: true,
  hasVoice: false,
  hasWebAccess: false,
  hasComputerControl: false,
  hasBackgroundProcessing: false,
  hasVectorSearch: false,
  hasToolCalling: false,
  hasStreaming: runtimeIdentity.inferenceBackend === "arcon-lora",
});

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
  runtimeIdentity,
  runtimeCapabilities,
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
    adapterName: runtimeIdentity.adapterName,
    adapterActive: runtimeIdentity.adapterActive,
    baseModel: runtimeIdentity.baseModel,
    runtimeStatus: runtimeIdentity.adapterActive ? "ready" : "degraded",
    ...(config.inferenceBackend === "ollama"
      ? { ollamaBaseUrl: config.ollamaBaseUrl, ollamaModel: config.ollamaModel }
      : { arconInferenceBaseUrl: config.arconInferenceBaseUrl, arconAdapterName: config.arconAdapterName }),
  });
});
