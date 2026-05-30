import type { AiClient, ChatMessage } from "@arcon/shared";
export * from "./prompt-builder.js";
export * from "./chat-service.js";
export * from "./context/intent-classifier.js";
export * from "./reasoning/index.js";

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
}

export function createOllamaClient(options: OllamaClientOptions): AiClient {
  return new OllamaClient(options);
}
