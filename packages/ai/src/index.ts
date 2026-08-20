import type { AiClient, ChatMessage } from "@arcon/shared";
export * from "./prompt-builder.js";
export * from "./chat-service.js";
export * from "./conversation-context.js";
export * from "./cognitive-adapter.js";
export * from "./context/intent-classifier.js";
export * from "./reasoning/index.js";
export * from "./experience/arcon-experience-classifier.js";

export interface OllamaClientOptions {
  baseUrl: string;
  model: string;
}

interface OllamaChatResponse {
  message?: {
    role: string;
    content: string;
  };
  error?: string;
  done?: boolean;
}

interface OllamaStreamChunk {
  model?: string;
  created_at?: string;
  message?: {
    role: string;
    content: string;
  };
  done?: boolean;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaClient implements AiClient {
  private readonly baseUrl: string;

  constructor(private readonly options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async generateReply(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        stream: false,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    if (data.error) {
      throw new Error(data.error);
    }

    const reply = data.message?.content?.trim();
    if (!reply) {
      throw new Error("Ollama returned an empty response");
    }

    return reply;
  }

  async *generateReplyStream(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        stream: true,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Ollama returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            continue;
          }

          let chunk: OllamaStreamChunk;
          try {
            chunk = JSON.parse(line) as OllamaStreamChunk;
          } catch {
            continue;
          }

          if (chunk.done) {
            break;
          }

          const content = chunk.message?.content;
          if (content) {
            yield content;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function createOllamaClient(options: OllamaClientOptions): AiClient {
  return new OllamaClient(options);
}
