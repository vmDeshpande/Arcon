import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  ArconEventType,
  EventBus,
  type AiClient,
  type ChatRequest,
  type ChatResponse,
  type ConversationMemory
} from "@arcon/shared";

export interface CreateAppOptions {
  aiClient: AiClient;
  memory: ConversationMemory;
  eventBus: EventBus;
  contextLimit: number;
}

export function createApp(options: CreateAppOptions) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request: Request, response: Response) => {
    response.json({ status: "ok" });
  });

  app.post("/chat", async (request: Request<object, ChatResponse | { error: string }, ChatRequest>, response: Response) => {
    const message = request.body?.message?.trim();
    const conversationId = request.body?.conversationId?.trim() || randomUUID();

    if (!message) {
      response.status(400).json({ error: "message is required" });
      return;
    }

    try {
      await options.eventBus.emit(ArconEventType.MESSAGE_RECEIVED, {
        conversationId,
        message
      });

      const storedUserMessage = await options.memory.storeMessage({
        conversationId,
        role: "user",
        content: message
      });
      await options.eventBus.emit(ArconEventType.MESSAGE_STORED, { message: storedUserMessage });

      const recentMessages = await options.memory.getRecentMessages(conversationId, options.contextLimit);
      const reply = await options.aiClient.generateReply(recentMessages);
      await options.eventBus.emit(ArconEventType.AI_RESPONSE_GENERATED, {
        conversationId,
        reply
      });

      const storedAssistantMessage = await options.memory.storeMessage({
        conversationId,
        role: "assistant",
        content: reply
      });
      await options.eventBus.emit(ArconEventType.MESSAGE_STORED, { message: storedAssistantMessage });

      response.json({ reply, conversationId });
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
