import type { AiClient, ChatMessage } from "@arcon/shared";
import type { RuntimeIdentity } from "../runtime-identity.js";

export interface ArconLoRAProviderOptions {
  baseUrl: string;
  model?: string;
  timeoutMs?: number;
}

interface LoRAHealthResponse {
  status: string;
  model_loaded: boolean;
}

interface LoRAModelInfoResponse {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  base_model: string;
  adapter_name: string;
  adapter_path: string;
  adapter_version: string;
  inference_backend: string;
  gpu_memory: {
    allocated_MB: number;
    reserved_MB: number;
  };
  loaded_at: string;
}

export class ArconLoRAProvider implements AiClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private modelInfo: LoRAModelInfoResponse | null = null;

  constructor(private readonly options: ArconLoRAProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.model = options.model ?? "arcon-v1";
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async generateReply(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Arcon LoRA inference failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message?: { role?: string; content?: string };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("Arcon LoRA inference returned an empty response");
    }

    return reply;
  }

  async *generateReplyStream(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Arcon LoRA inference failed (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Arcon LoRA inference returned an empty response body");
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
            const payload = line.slice(6);
            if (payload.trim() === "[DONE]") {
              return;
            }

            let chunk: { choices?: Array<{ delta?: { content?: string } }> };
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }

            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as LoRAHealthResponse;
      return data.status === "ok" && data.model_loaded === true;
    } catch {
      return false;
    }
  }

  async getModelInfo(): Promise<LoRAModelInfoResponse> {
    if (this.modelInfo) {
      return this.modelInfo;
    }

    const response = await fetch(`${this.baseUrl}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch model info (${response.status}): ${text}`);
    }

    this.modelInfo = (await response.json()) as LoRAModelInfoResponse;
    return this.modelInfo;
  }

  async getRuntimeIdentity(): Promise<RuntimeIdentity> {
    try {
      const info = await this.getModelInfo();

      return {
        baseModel: info.base_model,
        adapterName: info.adapter_name,
        adapterVersion: info.adapter_version,
        adapterPath: info.adapter_path,
        inferenceBackend: "arcon-lora",
        adapterActive: info.adapter_name !== "none" && info.adapter_path !== "none",
        loadedAt: info.loaded_at,
        gpuMemoryAllocatedMB: info.gpu_memory.allocated_MB,
        gpuMemoryReservedMB: info.gpu_memory.reserved_MB,
      };
    } catch {
      return {
        baseModel: "Qwen/Qwen3-4B",
        adapterName: this.model,
        adapterVersion: "unknown",
        adapterPath: "unknown",
        inferenceBackend: "arcon-lora",
        adapterActive: false,
        loadedAt: "",
        gpuMemoryAllocatedMB: 0,
        gpuMemoryReservedMB: 0,
      };
    }
  }

  async isAdapterActive(): Promise<boolean> {
    try {
      const identity = await this.getRuntimeIdentity();
      return identity.adapterActive;
    } catch {
      return false;
    }
  }
}

export function createArconLoRAProvider(options: ArconLoRAProviderOptions): ArconLoRAProvider {
  return new ArconLoRAProvider(options);
}
