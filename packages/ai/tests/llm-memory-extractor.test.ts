import assert from "node:assert/strict";
import test from "node:test";

import { MemoryType } from "@arcon/memory";
import type { AiClient, ChatMessage } from "@arcon/shared";

import { LlmMemoryExtractor } from "../src/semantic-memory/llm-memory-extractor.js";

class FakeAiClient implements AiClient {
  constructor(private readonly response: string) {}

  async generateReply(_messages: ChatMessage[]): Promise<string> {
    return this.response;
  }
}

test("repairs compound dog relationship extraction when LLM drops relationship", async () => {
  const extractor = new LlmMemoryExtractor(
    new FakeAiClient(
      JSON.stringify([
        {
          type: "FACT",
          content: "Murphy likes dog food",
          confidenceScore: 0.95,
          importanceScore: 6,
        },
      ]),
    ),
  );

  const memories = await extractor.extract(
    "My dog's name is Murphy and he likes dog food",
  );

  assert.deepEqual(
    memories.map((memory) => [memory.type, memory.content]),
    [
      [MemoryType.RELATIONSHIP, "User's dog is Murphy"],
      [MemoryType.PREFERENCE, "Murphy likes dog food"],
    ],
  );
});

test("repairs compound father relationship extraction when LLM drops relationship", async () => {
  const extractor = new LlmMemoryExtractor(
    new FakeAiClient(
      JSON.stringify([
        {
          type: "FACT",
          content: "Milind likes buttermilk",
          confidenceScore: 0.95,
          importanceScore: 6,
        },
      ]),
    ),
  );

  const memories = await extractor.extract(
    "My dad's name is Milind and he likes buttermilk",
  );

  assert.deepEqual(
    memories.map((memory) => [memory.type, memory.content]),
    [
      [MemoryType.RELATIONSHIP, "User's father is Milind"],
      [MemoryType.PREFERENCE, "Milind likes buttermilk"],
    ],
  );
});

test("keeps same-message identity preferences on User", async () => {
  const extractor = new LlmMemoryExtractor(
    new FakeAiClient(
      JSON.stringify([
        {
          type: "FACT",
          content: "Vedant likes buttermilk",
          confidenceScore: 0.95,
          importanceScore: 7,
        },
      ]),
    ),
  );

  const memories = await extractor.extract(
    "My name is Vedant and I like buttermilk",
  );

  assert.deepEqual(
    memories.map((memory) => [memory.type, memory.content]),
    [
      [MemoryType.RELATIONSHIP, "User's self is Vedant"],
      [MemoryType.PREFERENCE, "User likes buttermilk"],
    ],
  );
});

test("recovers building relationship for project statements", async () => {
  const extractor = new LlmMemoryExtractor(
    new FakeAiClient(
      JSON.stringify([
        {
          type: "PROJECT",
          content: "User is building Arcon",
          confidenceScore: 0.95,
          importanceScore: 8,
        },
      ]),
    ),
  );

  const memories = await extractor.extract("I am building Arcon");

  assert(
    memories.some(
      (memory) =>
        memory.type === MemoryType.RELATIONSHIP &&
        memory.content === "User's building is Arcon",
    ),
  );
});
