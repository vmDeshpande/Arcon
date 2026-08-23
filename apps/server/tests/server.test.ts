import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { EventBus } from "@arcon/shared";
import { createConversationMemory } from "@arcon/memory";

class FakeAiClient {
  async generateReply(messages: Array<{ role: string; content: string }>): Promise<string> {
    const last = messages[messages.length - 1];
    return `reply to ${last?.content ?? ""}`;
  }

  async *generateReplyStream(messages: Array<{ role: string; content: string }>): AsyncIterable<string> {
    yield "streamed ";
    yield "reply";
  }
}

function createTestApp() {
  const memory = createConversationMemory(":memory:");
  const eventBus = new EventBus();

  const app = createApp({
    aiClient: new FakeAiClient() as any,
    memory,
    eventBus,
    contextLimit: 12,
    inferenceBackend: "arcon-lora",
    ollamaModel: "llama3.2",
    arconInferenceBaseUrl: "http://127.0.0.1:9999",
    arconAdapterName: "arcon-v1",
  });

  return { app };
}

async function request(app: ReturnType<typeof createApp>["app"], path: string, method = "GET", body?: any): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const responseBody = await response.json();
        server.close(() => resolve({ statusCode: response.status, body: responseBody }));
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

describe("Server integration", () => {
  it("health endpoint returns ok", async () => {
    const { app } = createTestApp();
    const { statusCode, body } = await request(app, "/health");

    assert.equal(statusCode, 200);
    assert.equal(body.status, "ok");
  });

  it("model-info returns ollama metadata when backend is ollama", async () => {
    const memory = createConversationMemory(":memory:");
    const eventBus = new EventBus();

    const app = createApp({
      aiClient: new FakeAiClient() as any,
      memory,
      eventBus,
      contextLimit: 12,
      inferenceBackend: "ollama",
      ollamaModel: "llama3.2",
      arconInferenceBaseUrl: "http://127.0.0.1:9999",
      arconAdapterName: "arcon-v1",
    });

    const { statusCode, body } = await request(app, "/model-info");

    assert.equal(statusCode, 200);
    assert.equal(body.inferenceBackend, "ollama");
    assert.equal(body.model.base_model, "llama3.2");
    assert.equal(body.model.adapter_name, "none");
    assert.equal(body.model.inference_backend, "Ollama");
  });

  it("chat endpoint stores messages and returns a reply", async () => {
    const { app } = createTestApp();

    await new Promise<void>((resolve, reject) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as any).port;
        try {
          const response = await fetch(`http://127.0.0.1:${port}/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello Arcon" }),
          });

          const body = await response.json();
          server.close(() => resolve());

          assert.equal(response.status, 200);
          assert.ok(body.reply.includes("Hello Arcon"));
          assert.ok(body.conversationId);
        } catch (error) {
          server.close(() => reject(error));
        }
      });
    });
  });
});
