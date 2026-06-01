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
});
