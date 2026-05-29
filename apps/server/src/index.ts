import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOllamaClient } from "@arcon/ai";
import { createLogger } from "@arcon/logger";
import { createConversationMemory } from "@arcon/memory";
import { EventBus } from "@arcon/shared";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { registerEventLogging } from "./events.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

const config = loadConfig();
const logger = createLogger(config.logsDir);
const eventBus = new EventBus();
const memory = createConversationMemory(config.memoryDatabasePath);
const aiClient = createOllamaClient({
  baseUrl: config.ollamaBaseUrl,
  model: config.ollamaModel
});

registerEventLogging(eventBus, logger);

const app = createApp({
  aiClient,
  memory,
  eventBus,
  contextLimit: config.contextLimit
});

app.listen(config.port, () => {
  logger.info("Arcon server started", {
    port: config.port,
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel
  });
});
