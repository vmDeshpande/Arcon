import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MemoryPipeline,
  MemoryRepository,
} from "@arcon/memory";
import { MoodRepository } from "@arcon/personality";
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

    assert(result.prompt.includes("Frustration Level: 1"));
    assert(result.prompt.includes("Ask Count: 1"));
    assert(result.prompt.includes("Question frequency guidance"));

    service.close();

    const moodRepository = new MoodRepository(moodDatabasePath);
    const mood = moodRepository.getMood();

    assert.equal(mood.frustration, 1);
    assert.equal(mood.askCount, 2);

    moodRepository.close();
  });

  it("reduces questioning guidance when ask count is high", async () => {
    const { service } = createService([
      "[]",
      "Question one?",
      "[]",
      "Question two?",
      "[]",
      "Question three?",
      "[]",
      "Question four?",
      "[]",
      "Question five?",
      "[]",
      "Question six?",
      "[]",
      "A statement.",
    ]);

    for (let index = 0; index < 6; index += 1) {
      await service.chat(`Topic shift ${index}`);
    }

    const result = await service.chat("My sister likes tea");

    assert(result.prompt.includes("Ask Count: 6"));
    assert(result.prompt.includes("Avoid routine follow-up questions"));

    service.close();
  });

  it("decays frustration and ask count after positive engagement", async () => {
    const { service, moodDatabasePath } = createService([
      "[]",
      "What hobbies do you enjoy?",
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
