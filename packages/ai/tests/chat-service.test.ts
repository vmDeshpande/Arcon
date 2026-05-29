import { describe, it } from "node:test";
import assert from "node:assert";

import {
  MemoryRepository,
  MemoryPipeline
} from "@arcon/memory";

import { ChatService } from "../src/chat-service.js";

describe("ChatService", () => {
  it("injects memories into prompt", () => {
    const repository =
      new MemoryRepository(":memory:");

    const pipeline =
      new MemoryPipeline(repository);

    pipeline.processMessage(
      "My favorite language is TypeScript"
    );

    const service =
      new ChatService(
        repository,
        pipeline
      );

    const result =
      service.chat(
        "What programming language should I use?"
      );

    assert(
      result.prompt.includes("TypeScript")
    );
  });

  it("creates memories from new messages", () => {
    const repository =
      new MemoryRepository(":memory:");

    const pipeline =
      new MemoryPipeline(repository);

    const service =
      new ChatService(
        repository,
        pipeline
      );

    service.chat(
      "I prefer TypeScript"
    );

    const memories =
      repository.listMemories();

    assert(memories.length > 0);
  });
});