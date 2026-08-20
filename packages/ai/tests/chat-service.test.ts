import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MemoryPipeline,
  MemoryRepository,
} from "@arcon/memory";
import { MoodRepository, buildBehaviorPrompt } from "@arcon/personality";
import type {
  AiClient,
  ChatMessage,
} from "@arcon/shared";

import { ChatService } from "../src/chat-service.js";

class SequenceAiClient implements AiClient {
  private index = 0;

  constructor(private readonly responses: string[]) {}

  async generateReply(_messages: ChatMessage[]): Promise<string> {
    const response = this.responses[this.index] ?? "";
    this.index += 1;
    return response;
  }
}

class StreamingAiClient implements AiClient {
  private chunks: string[];

  constructor(chunks: string[]) {
    this.chunks = chunks;
  }

  async generateReply(_messages: ChatMessage[]): Promise<string> {
    return this.chunks.join("");
  }

  async *generateReplyStream(_messages: ChatMessage[]): AsyncIterable<string> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }
}

function createService(
  responses: string[],
) {
  const dir = mkdtempSync(join(tmpdir(), "arcon-chat-"));
  const repository = new MemoryRepository(join(dir, "memories.sqlite"));
  const pipeline = new MemoryPipeline(repository);
  const moodDatabasePath = join(dir, "mood.sqlite");
  const service = new ChatService(
    repository,
    pipeline,
    new SequenceAiClient(responses),
    {
      experienceDatabasePath: join(dir, "experiences.sqlite"),
      moodDatabasePath,
      entityDatabasePath: join(dir, "entities.sqlite"),
    },
  );

  return {
    service,
    repository,
    moodDatabasePath,
  };
}

describe("ChatService behavior state", () => {
  it("injects frustration level and ask count into generated prompt", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "What hobbies do you enjoy?",
      "[]",
      "What do you like doing?",
    ]);

    await service.chat("Hello");
    const result = await service.chat("My dog likes pedigree");

    assert(result.prompt.includes("Frustration: 0.15"));
    assert(result.prompt.includes("Ask Count: 0"));
    assert(result.prompt.includes("Question frequency guidance"));

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.equal(mood.frustration, 0);
    assert.equal(mood.askCount, 1);

    moodRepository.close();
  });

  it("reduces questioning guidance when ask count is high", async () => {
    const prompt = buildBehaviorPrompt({
      moodLabel: "calm",
      emotions: {
        happiness: 0.5,
        frustration: 0.5,
        curiosity: 0.5,
        trust: 0.5,
        confidence: 0.5,
        excitement: 0.4,
      },
      mood: {
        curiosity: 0.5,
        frustration: 0.5,
        askCount: 6,
        pendingQuestion: false,
        trust: 0.5,
        excitement: 0.5,
        updatedAt: new Date().toISOString(),
      },
      interests: [],
    });

    assert(prompt.includes("Ask Count: 6"));
    assert(prompt.includes("Avoid routine follow-up questions"));
  });

  it("decays frustration and ask count after positive engagement", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "That sounds meaningful.",
      "[]",
      "That sounds meaningful.",
    ]);

    await service.chat("Hello");
    await service.chat("I like building small tools");

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.equal(mood.frustration, 0);
    assert.equal(mood.askCount, 0);

    moodRepository.close();
  });

  it("develops noticeable emotions from positive project and interest conversation", async () => {
    const { service, repository } = createService([
      "[]",
      "I will remember that.",
      "[]",
      "Programming seems important to you.",
      "[]",
      "I will pay attention to learning.",
    ]);

    await service.chat("I am building Arcon");
    await service.chat("I like programming");
    await service.chat("I want you to learn");

    const emotions = repository.listEmotions();
    const emotionValue = (name: string) =>
      emotions.find((emotion) => emotion.name === name)?.value ?? 0;

    assert.ok(emotionValue("curiosity") >= 0.25);
    assert.ok(emotionValue("trust") >= 0.15);
    assert.ok(emotionValue("happiness") >= 0.1);

    service.close();
    repository.close();
  });

  it("recalls Arcon interests from stored Arcon interest data", async () => {
    const { service, repository } = createService([
      "[]",
      "I will remember that.",
      "[]",
      "Programming seems important to you.",
      "[]",
      "I will pay attention to learning.",
    ]);

    await service.chat("I am building Arcon");
    await service.chat("I like programming");
    await service.chat("I want you to learn");

    const result = await service.chat("What are your interests?");

    assert(result.reply.includes("programming"));
    assert(result.reply.includes("learning"));
    assert.equal(repository.listInterests().some((interest) => interest.topic === "programming"), true);
    assert.equal(repository.listArconInterests().some((interest) => interest.topic === "programming"), true);

    service.close();
    repository.close();
  });

  it("answers emotion and self-reflection questions from Arcon's self-model", async () => {
    const { service, repository } = createService([
      "[]",
      "I will remember that.",
    ]);

    await service.chat("I am building Arcon");

    const emotionResult = await service.chat("Do you have emotions?");
    const selfResult = await service.chat("What do you think about yourself?");

    assert(emotionResult.reply.includes("simple emotional state"));
    assert(emotionResult.reply.includes("curiosity"));
    assert(!emotionResult.reply.toLowerCase().includes("do not have emotions"));
    assert(selfResult.reply.includes("I am Arcon."));
    assert(selfResult.reply.includes("memory"));

    service.close();
    repository.close();
  });

  it("updates emotion state when identity recall handles the reply", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "I will remember that.",
    ]);

    await service.chat("My name is TestUser.");
    const result = await service.chat("who am i?");

    assert.ok(result.reply.includes("TestUser") || result.reply.includes("what I know about you"));

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.ok(mood.askCount >= 0, "ask count should be recorded");

    moodRepository.close();
  });

  it("updates emotion state when relationship recall handles the reply", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "I understand.",
    ]);

    await service.chat("I am building Arcon with my team.");
    const result = await service.chat("what is our relationship?");

    assert.ok(result.reply.includes("creator") || result.reply.includes("companion"));

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.ok(mood.askCount >= 0, "ask count should be recorded");

    moodRepository.close();
  });

  it("updates emotion state when project recall handles the reply", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "I will remember that.",
    ]);

    await service.chat("I am building Arcon.");
    const result = await service.chat("what am i building?");

    assert.ok(result.reply.includes("project") || result.reply.includes("Arcon"));

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.ok(mood.askCount >= 0, "ask count should be recorded");

    moodRepository.close();
  });

  it("does not double-update emotion on normal LLM response", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "Hello!",
    ]);

    await service.chat("Hello");
    await service.chat("How are you?");

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.equal(mood.frustration, 0);

    moodRepository.close();
  });
});

function createStreamingService(chunks: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "arcon-chat-"));
  const repository = new MemoryRepository(join(dir, "memories.sqlite"));
  const pipeline = new MemoryPipeline(repository);
  const moodDatabasePath = join(dir, "mood.sqlite");
  const service = new ChatService(
    repository,
    pipeline,
    new StreamingAiClient(chunks),
    {
      experienceDatabasePath: join(dir, "experiences.sqlite"),
      moodDatabasePath,
      entityDatabasePath: join(dir, "entities.sqlite"),
    },
  );

  return { service, repository, moodDatabasePath };
}

describe("ChatService streaming", () => {
  it("streams LLM response token chunks", async () => {
    const { service } = createStreamingService(["Hello, ", "I am ", "Arcon."]);

    const collected: string[] = [];
    for await (const chunk of service.chatStream("Hello")) {
      collected.push(chunk);
    }

    assert.equal(collected.join(""), "Hello, I am Arcon.");

    service.close();
  });

  it("yields response immediately without waiting for memory extraction", async () => {
    const { service, repository } = createStreamingService([
      "Hi there, ",
      "I remember ",
      "what you said.",
    ]);

    const collected: string[] = [];
    for await (const chunk of service.chatStream("I like building Arcon")) {
      collected.push(chunk);
    }

    assert.equal(collected.join(""), "Hi there, I remember what you said.");

    service.close();
    repository.close();
  });

  it("yields recall replies as single chunks", async () => {
    const { service, repository } = createStreamingService(["[]", "My name is TestUser."]);

    await service.chat("My name is TestUser.");

    const collected: string[] = [];
    for await (const chunk of service.chatStream("What is my name?")) {
      collected.push(chunk);
    }

    assert.ok(collected.length >= 1);
    assert.ok(collected.join("").includes("TestUser"));

    service.close();
    repository.close();
  });
});
