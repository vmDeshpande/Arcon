import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArconEventType,
  EventBus,
  type AiClient,
  type ChatRequest,
  type ChatResponse,
  type ConversationMemory
} from "@arcon/shared";
import { ChatService, type ChatServiceOptions } from "@arcon/ai";
import { MemoryRepository, MemoryPipeline } from "@arcon/memory";

export interface CreateAppOptions {
  aiClient: AiClient;
  memory: ConversationMemory;
  eventBus: EventBus;
  contextLimit: number;
  inferenceBackend: "ollama" | "arcon-lora";
  ollamaModel?: string;
  arconInferenceBaseUrl?: string;
  arconAdapterName?: string;
  chatServiceOptions?: ChatServiceOptions;
  memoryDatabasePath?: string;
}

export function createApp(options: CreateAppOptions) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

  app.get("/", (_request: Request, response: Response) => {
    response.sendFile(join(publicDir, "index.html"));
  });

  app.use(express.static(publicDir));

  app.get("/health", (_request: Request, response: Response) => {
    response.json({ status: "ok" });
  });

  app.get("/model-info", async (_request: Request, response: Response) => {
    try {
      if (options.inferenceBackend === "arcon-lora" && options.arconInferenceBaseUrl) {
        const info = await fetch(`${options.arconInferenceBaseUrl}/v1/models`).then((r) => {
          if (!r.ok) throw new Error(`upstream ${r.status}`);
          return r.json();
        });

        response.json({
          inferenceBackend: options.inferenceBackend,
          model: info,
        });
      } else {
        response.json({
          inferenceBackend: options.inferenceBackend,
          model: {
            base_model: options.ollamaModel ?? "unknown",
            adapter_name: "none",
            adapter_path: "none",
            adapter_version: "unknown",
            inference_backend: "Ollama",
          },
        });
      }
    } catch (error) {
      response.status(500).json({ error: "failed to fetch model info" });
    }
  });

  const repository = new MemoryRepository(
    options.chatServiceOptions?.conversationDatabasePath
      ? join(dirname(options.chatServiceOptions.conversationDatabasePath), "personal-memory.sqlite")
      : join(dirname(options.memoryDatabasePath || "./data/memories/conversation.sqlite"), "personal-memory.sqlite"),
  );
  const pipeline = new MemoryPipeline(repository);

  const chatServices = new Map<string, ChatService>();

  function getChatService(conversationId: string): ChatService {
    let service = chatServices.get(conversationId);
    if (!service) {
      service = new ChatService(
        repository,
        pipeline,
        options.aiClient,
        options.chatServiceOptions,
        conversationId,
      );
      chatServices.set(conversationId, service);
    }
    return service;
  }

  app.post("/chat", async (request: Request<object, ChatResponse | { error: string }, ChatRequest>, response: Response) => {
    const message = request.body?.message?.trim();
    const conversationId = request.body?.conversationId?.trim() || randomUUID();

    if (!message) {
      response.status(400).json({ error: "message is required" });
      return;
    }

    try {
      const chatService = getChatService(conversationId);
      const result = await chatService.chat(message);

      response.json({
        reply: result.reply,
        conversationId,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      await options.eventBus.emit(ArconEventType.ERROR_OCCURRED, {
        error: normalizedError,
        context: "POST /chat"
      });
      response.status(500).json({ error: "failed to generate reply" });
    }
  });

  return app;
}
