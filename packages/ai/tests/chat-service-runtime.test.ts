import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MemoryPipeline,
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemorySourceType,
} from "@arcon/memory";
import type { AiClient, ChatMessage } from "@arcon/shared";

import { ChatService } from "../src/chat-service.js";
import { DEFAULT_RUNTIME_IDENTITY } from "../src/runtime-identity.js";
import { buildRuntimeCapabilities } from "../src/runtime-state.js";

class MockAiClient implements AiClient {
  callCount = 0;

  async generateReply(_messages: ChatMessage[]): Promise<string> {
    this.callCount += 1;
    return "default reply";
  }
}

function createRuntimeCapabilities(adapterActive = true) {
  return buildRuntimeCapabilities({
    identity: {
      ...DEFAULT_RUNTIME_IDENTITY,
      baseModel: "Qwen/Qwen3-4B",
      adapterName: "arcon-v1",
      adapterVersion: "rank-8",
      adapterActive,
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
}

function createService(
  aiClient: AiClient,
  options: { adapterActive?: boolean; conversationDbPath?: string; contextWindow?: number } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "arcon-runtime-"));
  const repository = new MemoryRepository(join(dir, "memories.sqlite"));
  const pipeline = new MemoryPipeline(repository);

  const conversationDbPath =
    options.conversationDbPath ?? join(dir, "conversations.sqlite");

  const service = new ChatService(
    repository,
    pipeline,
    aiClient,
    {
      experienceDatabasePath: join(dir, "experiences.sqlite"),
      moodDatabasePath: join(dir, "mood.sqlite"),
      entityDatabasePath: join(dir, "entities.sqlite"),
      conversationDatabasePath: conversationDbPath,
      runtimeIdentity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        baseModel: "Qwen/Qwen3-4B",
        adapterName: "arcon-v1",
        adapterVersion: "rank-8",
        adapterActive: options.adapterActive ?? true,
        inferenceBackend: "arcon-lora",
      },
      runtimeCapabilities: createRuntimeCapabilities(options.adapterActive ?? true),
      contextWindow: options.contextWindow,
    },
    "conv-1",
  );

  return { service, repository, conversationDbPath };
}

describe("ChatService capability recall", () => {
  it("short-circuits model queries without calling the LLM", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient);

    const result = await service.chat("What model are you running?");

    assert.equal(aiClient.callCount, 0);
    assert.ok(result.reply.includes("Qwen/Qwen3-4B"));
    assert.ok(result.reply.includes("arcon-v1"));
    assert(result.prompt.includes("Capability recall"));

    service.close();
  });

  it("short-circuits adapter queries without calling the LLM", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient);

    const result = await service.chat("What adapter are you using?");

    assert.equal(aiClient.callCount, 0);
    assert.ok(result.reply.includes("arcon-v1"));

    service.close();
  });

  it("short-circuits creator queries without calling the LLM", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient);

    const result = await service.chat("Who created you?");

    assert.equal(aiClient.callCount, 0);
    assert.ok(result.reply.includes("Vedant"));

    service.close();
  });

  it("short-circuits self-identity queries without calling the LLM", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient);

    const result = await service.chat("Who are you?");

    assert.equal(aiClient.callCount, 0);
    assert.ok(result.reply.includes("Arcon"));

    service.close();
  });

  it("short-circuits identity questions without LLM when adapter is inactive", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient, { adapterActive: false });

    const result = await service.chat("What adapter are you running?");

    assert.equal(aiClient.callCount, 0);
    assert.ok(result.reply.toLowerCase().includes("no adapter") || result.reply.toLowerCase().includes("not active"));

    service.close();
  });

  it("falls through to LLM for non-capability questions", async () => {
    const aiClient = new MockAiClient();
    const { service } = createService(aiClient);

    const result = await service.chat("Tell me about your day");

    assert.ok(aiClient.callCount > 0);
    assert.equal(result.reply, "default reply");

    service.close();
  });
});

describe("ChatService persistent conversation reconstruction", () => {
  it("reconstructs conversation context from store on startup", async () => {
    const aiClient = new MockAiClient();
    const { service, repository, conversationDbPath } = createService(aiClient);

    await service.chat("Hello, my name is Vedant");
    await service.chat("I like programming");
    service.close();

    const aiClient2 = new MockAiClient();
    const service2 = new ChatService(
      repository,
      new MemoryPipeline(repository),
      aiClient2,
      {
        experienceDatabasePath: join(tmpdir(), `arcon-recon-experience-${Date.now()}.sqlite`),
        moodDatabasePath: join(tmpdir(), `arcon-recon-mood-${Date.now()}.sqlite`),
        entityDatabasePath: join(tmpdir(), `arcon-recon-entities-${Date.now()}.sqlite`),
        conversationDatabasePath: conversationDbPath,
        runtimeIdentity: {
          ...DEFAULT_RUNTIME_IDENTITY,
          baseModel: "Qwen/Qwen3-4B",
          adapterName: "arcon-v1",
          adapterActive: true,
          inferenceBackend: "arcon-lora",
        },
        runtimeCapabilities: createRuntimeCapabilities(true),
      },
      "conv-1",
    );

    assert.equal(service2["contextWindow"], 20);
    const history = service2["conversationContext"].getHistory("conv-1");
    assert.ok(history.length > 0, "should have reconstructed conversation history");

    service2.close();
  });

  it("uses contextWindow to bound reconstruction", async () => {
    const aiClient = new MockAiClient();
    const { service, repository, conversationDbPath } = createService(aiClient, { contextWindow: 5 });

    for (let i = 0; i < 10; i++) {
      await service.chat(`Message ${i}`);
    }
    service.close();

    const aiClient2 = new MockAiClient();
    const service2 = new ChatService(
      repository,
      new MemoryPipeline(repository),
      aiClient2,
      {
        experienceDatabasePath: join(tmpdir(), `arcon-recon2-exp-${Date.now()}.sqlite`),
        moodDatabasePath: join(tmpdir(), `arcon-recon2-mood-${Date.now()}.sqlite`),
        entityDatabasePath: join(tmpdir(), `arcon-recon2-ent-${Date.now()}.sqlite`),
        conversationDatabasePath: conversationDbPath,
        runtimeIdentity: {
          ...DEFAULT_RUNTIME_IDENTITY,
          baseModel: "Qwen/Qwen3-4B",
          adapterName: "arcon-v1",
          adapterActive: true,
          inferenceBackend: "arcon-lora",
        },
        runtimeCapabilities: createRuntimeCapabilities(true),
        contextWindow: 5,
      },
      "conv-1",
    );

    const history = service2["conversationContext"].getHistory("conv-1");
    assert.ok(history.length <= 5, `expected at most 5 turns, got ${history.length}`);

    service2.close();
  });
});
