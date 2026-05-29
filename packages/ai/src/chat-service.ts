import {
  MemoryRepository,
  MemoryPipeline,
  MemoryRetriever,
  buildMemoryContext,
} from "@arcon/memory";

import { PromptBuilder } from "./prompt-builder.js";

export interface ChatResult {
  prompt: string;
}

export class ChatService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly pipeline: MemoryPipeline,
  ) {}

  chat(message: string): ChatResult {
    const retriever = new MemoryRetriever(this.repository);

    const memories = retriever.retrieveRelevantMemories(message);

    const memoryContext = buildMemoryContext(memories);

    const prompt = new PromptBuilder().build({
      systemPrompt: "You are Arcon.",
      memoryContext,
      conversationHistory: [],
      userMessage: message,
    });

    this.pipeline.processMessage(message);

    return {
      prompt,
    };
  }
}
