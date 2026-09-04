import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CapabilityRecall } from "../src/capability-recall.js";
import { DEFAULT_RUNTIME_IDENTITY } from "../src/runtime-identity.js";
import { buildRuntimeCapabilities } from "../src/runtime-state.js";
import type { RuntimeState } from "../src/runtime-state.js";

function createRecall(identity: Partial<typeof DEFAULT_RUNTIME_IDENTITY> = {}) {
  const fullIdentity = { ...DEFAULT_RUNTIME_IDENTITY, ...identity };
  const capabilities = buildRuntimeCapabilities({
    identity: fullIdentity,
    hasPersistentMemory: true,
    hasConversationPersistence: true,
    hasVoice: false,
    hasWebAccess: false,
    hasComputerControl: false,
    hasBackgroundProcessing: false,
    hasVectorSearch: false,
    hasToolCalling: false,
    hasStreaming: true,
  });

  const state: RuntimeState = {
    version: "0.2.0",
    generatedAt: new Date().toISOString(),
    identity: fullIdentity,
    capabilities,
    status: "ready",
  };

  return new CapabilityRecall(state);
}

describe("CapabilityRecall", () => {
  it("recognizes model queries", () => {
    const recall = createRecall({ baseModel: "Qwen/Qwen3-4B", adapterName: "arcon-v1", adapterVersion: "rank-8", adapterActive: true });
    const result = recall.handleMessage("What model are you running?");

    assert.ok(result.reply);
    assert(result.reply?.includes("Qwen/Qwen3-4B"));
    assert(result.reply?.includes("arcon-v1"));
    assert.equal(result.category, "model");
  });

  it("recognizes adapter queries", () => {
    const recall = createRecall({ adapterName: "arcon-v1", adapterVersion: "rank-8", adapterActive: true });
    const result = recall.handleMessage("What adapter are you using?");

    assert.ok(result.reply);
    assert(result.reply?.includes("arcon-v1"));
    assert.equal(result.category, "adapter");
  });

  it("recognizes running adapter queries", () => {
    const recall = createRecall({ adapterName: "arcon-v1", adapterVersion: "rank-8", adapterActive: true });
    const result = recall.handleMessage("Are you running the Arcon adapter?");

    assert.ok(result.reply);
    assert.equal(result.category, "adapter");
  });

  it("reports adapter as inactive when not loaded", () => {
    const recall = createRecall({ adapterActive: false, adapterName: "none" });
    const result = recall.handleMessage("Are you running the Arcon adapter?");

    assert.ok(result.reply);
    assert(result.reply?.toLowerCase().includes("no adapter") || result.reply?.toLowerCase().includes("not active"));
    assert.equal(result.category, "adapter");
  });

  it("recognizes memory persistence queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Can you remember things across conversations?");

    assert.ok(result.reply);
    assert(result.reply?.includes("persistent") || result.reply?.includes("SQLite"));
    assert.equal(result.category, "memory");
  });

  it("recognizes web access queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Can you browse the web?");

    assert.ok(result.reply);
    assert.equal(result.category, "web");
  });

  it("recognizes tool availability queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Can you use tools?");

    assert.ok(result.reply);
    assert.equal(result.category, "tools");
  });

  it("recognizes self-identity queries", () => {
    const recall = createRecall({ baseModel: "Qwen/Qwen3-4B", adapterName: "arcon-v1", adapterVersion: "rank-8", adapterActive: true });
    const result = recall.handleMessage("Who are you?");

    assert.ok(result.reply);
    assert(result.reply?.includes("Arcon"));
    assert.equal(result.category, "self_identity");
  });

  it("recognizes creator queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Who created you?");

    assert.ok(result.reply);
    assert(result.reply?.includes("Vedant"));
    assert.equal(result.category, "creator");
  });

  it("does not short-circuit opinion questions", () => {
    const recall = createRecall();
    const result = recall.handleMessage("What do you think about yourself?");

    assert.equal(result.reply, null);
    assert.equal(result.category, "unknown");
  });

  it("does not short-circuit personal preference questions", () => {
    const recall = createRecall();
    const result = recall.handleMessage("What hobbies do you enjoy?");

    assert.equal(result.reply, null);
    assert.equal(result.category, "unknown");
  });

  it("returns null for non-capability questions", () => {
    const recall = createRecall();
    const result = recall.handleMessage("What is the weather today?");

    assert.equal(result.reply, null);
    assert.equal(result.category, "unknown");
  });

  it("classifies background processing queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Do you work in the background?");

    assert.ok(result.reply);
    assert.equal(result.category, "background");
  });

  it("classifies conversation persistence queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Does our conversation persist?");

    assert.ok(result.reply);
    assert.equal(result.category, "conversation_persistence");
  });

  it("classifies streaming queries", () => {
    const recall = createRecall();
    const result = recall.handleMessage("Can you stream responses?");

    assert.ok(result.reply);
    assert.equal(result.category, "streaming");
  });

  it("classifies backend queries", () => {
    const recall = createRecall({ adapterActive: true });
    const result = recall.handleMessage("What inference backend are you using?");

    assert.ok(result.reply);
    assert.equal(result.category, "backend");
  });
});
