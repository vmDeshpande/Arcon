import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemorySourceType,
} from "../src/personal-memory.js";

import { MemoryPipeline } from "../src/pipeline/memory-pipeline.js";

describe("MemoryPipeline", () => {
  let repository: MemoryRepository;
  let pipeline: MemoryPipeline;
  let databasePath: string;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");

    mkdirSync(tempDir, {
      recursive: true,
    });

    databasePath = join(
      tempDir,
      `pipeline-${Date.now()}-${Math.random()}.sqlite`,
    );

    repository = new MemoryRepository(databasePath);
    pipeline = new MemoryPipeline(repository);
  });

  it("creates a new memory", () => {
    const result = pipeline.processMessage(
      "My favorite language is TypeScript",
    );

    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.updated, 0);
    assert.strictEqual(result.ignored, 0);

    const memories = repository.listMemories({
      type: MemoryType.PREFERENCE,
    });

    assert.strictEqual(memories.length, 1);
    assert(memories[0].content.includes("TypeScript"));
  });

  it("ignores exact duplicate memories", () => {
    pipeline.processMessage("My favorite language is TypeScript");

    const result = pipeline.processMessage(
      "My favorite language is TypeScript",
    );

    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.ignored, 1);
  });

  it("reinforces an existing memory", () => {
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User prefers TypeScript",
      importanceScore: 6,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
    });

    const result = pipeline.processMessage("I prefer TypeScript");

    assert.strictEqual(result.ignored, 1);

    const memories = repository.listMemories({
      type: MemoryType.PREFERENCE,
    });

    assert.strictEqual(memories.length, 1);

    const memory = memories[0];

    assert(memory.confidenceScore >= 0.8);
    assert(memory.evidenceCount >= 1);
  });

  it("creates pending confirmation memory on conflict", () => {
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User prefers JavaScript",
      importanceScore: 6,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
    });

    const result = pipeline.processMessage(
      "My favorite language is TypeScript",
    );

    assert.strictEqual(result.created, 1);

    const memories = repository.listMemories({
      type: MemoryType.PREFERENCE,
    });

    assert.strictEqual(memories.length, 2);

    assert(memories.some((m) => m.content.includes("TypeScript")));
  });

  it("creates multiple memories from one message", () => {
    const result = pipeline.processMessage(
      "I use Windows 11 and my goal is to build Arcon",
    );

    assert.strictEqual(result.created, 2);

    const facts = repository.listMemories({
      type: MemoryType.FACT,
    });

    const goals = repository.listMemories({
      type: MemoryType.GOAL,
    });

    assert.strictEqual(facts.length, 1);
    assert.strictEqual(goals.length, 1);
  });

  it("rejects invalid messages", () => {
    const result = pipeline.processMessage("Hi");

    assert.strictEqual(result.created, 0);
    assert(result.rejected > 0);
  });
});
