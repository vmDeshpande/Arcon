import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createArconLoRAProvider, type ArconLoRAProviderOptions } from "../src/inference/arcon-lora-provider.js";

function createProvider(overrides: Partial<ArconLoRAProviderOptions> = {}) {
  const options: ArconLoRAProviderOptions = {
    baseUrl: "http://127.0.0.1:9999",
    model: "arcon-v1",
    timeoutMs: 500,
    ...overrides,
  };

  return { provider: createArconLoRAProvider(options), options };
}

describe("ArconLoRAProvider", () => {
  it("exposes the configured base URL", () => {
    const { provider, options } = createProvider({ baseUrl: "http://example.com:1234" });

    assert.equal((provider as { baseUrl?: string }).baseUrl, "http://example.com:1234");
  });

  it("healthCheck returns false when the upstream is unreachable", async () => {
    const { provider } = createProvider();

    const healthy = await provider.healthCheck();

    assert.equal(healthy, false);
  });

  it("generateReply throws when the upstream is unreachable", async () => {
    const { provider } = createProvider();

    await assert.rejects(
      provider.generateReply([{ conversationId: "c1", role: "user", content: "hi" }]),
      /Arcon LoRA inference failed|fetch failed/,
    );
  });
});
