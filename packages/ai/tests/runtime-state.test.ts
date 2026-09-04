import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildRuntimeCapabilities, buildRuntimeState, createDefaultRuntimeState } from "../src/runtime-state.js";
import { DEFAULT_RUNTIME_IDENTITY } from "../src/runtime-identity.js";

describe("RuntimeState", () => {
  it("buildRuntimeCapabilities reflects adapter-active state", () => {
    const caps = buildRuntimeCapabilities({
      identity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        baseModel: "Qwen/Qwen3-4B",
        adapterName: "arcon-v1",
        adapterVersion: "rank-8",
        adapterActive: true,
        inferenceBackend: "arcon-lora",
      },
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

    const adapterCap = caps.capabilities.find((c) => c.name === "trained Arcon adapter");
    assert.equal(adapterCap?.status, "IMPLEMENTED");
    assert(adapterCap?.notes?.includes("arcon-v1"));

    const streamingCap = caps.capabilities.find((c) => c.name === "streaming responses");
    assert.equal(streamingCap?.status, "IMPLEMENTED");
  });

  it("buildRuntimeCapabilities marks adapter as PARTIAL when not active", () => {
    const caps = buildRuntimeCapabilities({
      identity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        adapterActive: false,
        inferenceBackend: "arcon-lora",
      },
      hasPersistentMemory: true,
      hasConversationPersistence: true,
      hasVoice: false,
      hasWebAccess: false,
      hasComputerControl: false,
      hasBackgroundProcessing: false,
      hasVectorSearch: false,
      hasToolCalling: false,
      hasStreaming: false,
    });

    const adapterCap = caps.capabilities.find((c) => c.name === "trained Arcon adapter");
    assert.equal(adapterCap?.status, "PARTIAL");
  });

  it("buildRuntimeCapabilities marks conversation persistence as PARTIAL when false", () => {
    const caps = buildRuntimeCapabilities({
      identity: DEFAULT_RUNTIME_IDENTITY,
      hasPersistentMemory: true,
      hasConversationPersistence: false,
      hasVoice: false,
      hasWebAccess: false,
      hasComputerControl: false,
      hasBackgroundProcessing: false,
      hasVectorSearch: false,
      hasToolCalling: false,
      hasStreaming: false,
    });

    const convCap = caps.capabilities.find((c) => c.name === "conversation history");
    assert.equal(convCap?.status, "PARTIAL");
  });

  it("buildRuntimeState returns degraded status when adapter is inactive on arcon-lora", () => {
    const state = buildRuntimeState({
      identity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        adapterActive: false,
        inferenceBackend: "arcon-lora",
        baseModel: "Qwen/Qwen3-4B",
      },
      hasPersistentMemory: true,
      hasConversationPersistence: true,
      hasVoice: false,
      hasWebAccess: false,
      hasComputerControl: false,
      hasBackgroundProcessing: false,
      hasVectorSearch: false,
      hasToolCalling: false,
      hasStreaming: false,
    });

    assert.equal(state.status, "degraded");
  });

  it("buildRuntimeState returns ready status when adapter is active", () => {
    const state = buildRuntimeState({
      identity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        adapterActive: true,
        inferenceBackend: "arcon-lora",
        baseModel: "Qwen/Qwen3-4B",
        adapterName: "arcon-v1",
        adapterVersion: "rank-8",
      },
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

    assert.equal(state.status, "ready");
    assert.equal(state.identity.adapterActive, true);
  });

  it("createDefaultRuntimeState produces a valid state with default identity", () => {
    const state = createDefaultRuntimeState();

    assert.equal(state.identity.baseModel, "Qwen/Qwen3-4B");
    assert.equal(state.identity.adapterName, "arcon-v1");
    assert.equal(state.version, "0.2.0");
    assert(state.capabilities.capabilities.length > 0);
  });
});
