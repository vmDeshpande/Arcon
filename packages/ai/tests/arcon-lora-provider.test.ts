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

  it("getRuntimeIdentity returns fallback when upstream is unreachable", async () => {
    const { provider, options } = createProvider();

    const identity = await provider.getRuntimeIdentity();

    assert.equal(identity.baseModel, "Qwen/Qwen3-4B");
    assert.equal(identity.adapterName, options.model);
    assert.equal(identity.inferenceBackend, "arcon-lora");
    assert.equal(identity.adapterActive, false);
  });

  it("isAdapterActive returns false when upstream is unreachable", async () => {
    const { provider } = createProvider();

    const active = await provider.isAdapterActive();

    assert.equal(active, false);
  });

  it("getModelInfo caches after first successful fetch", async () => {
    const { provider } = createProvider({ baseUrl: "http://127.0.0.1:9998" });

    await assert.rejects(provider.getModelInfo(), /fetch failed/);
    await assert.rejects(provider.getModelInfo(), /fetch failed/);
  });
});
