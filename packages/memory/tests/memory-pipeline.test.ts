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

  it("normalizes relationship synonyms before storing duplicates", () => {
    const first = pipeline.processCandidates([
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's father is Milind",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    const second = pipeline.processCandidates([
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's dad is Milind",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    assert.strictEqual(first.created, 1);
    assert.strictEqual(second.created, 0);
    assert.strictEqual(second.ignored, 1);

    const relationships = repository.listMemories({
      type: MemoryType.RELATIONSHIP,
    });

    assert.strictEqual(relationships.length, 1);
    assert.strictEqual(relationships[0].content, "User's father is Milind");
  });

  it("drops blocked self-identity action relationships before storage", () => {
    const result = pipeline.processCandidates([
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's self is building",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    assert.strictEqual(result.created, 0);

    const relationships = repository.listMemories({
      type: MemoryType.RELATIONSHIP,
    });

    assert.strictEqual(relationships.length, 0);
  });

  it("drops redundant identity fact memories before storage", () => {
    const result = pipeline.processCandidates([
      {
        type: MemoryType.FACT,
        content: "Vedant's name is Vedant",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.FACT,
        content: "Madhura's name is Madhura",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.FACT,
        content: "Arcon is Arcon",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    assert.strictEqual(result.created, 0);
    assert.strictEqual(repository.listMemories().length, 0);
  });

  it("drops standalone entity declaration memories before storage", () => {
    const result = pipeline.processCandidates([
      {
        type: MemoryType.PROJECT,
        content: "Arcon",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.PROJECT,
        content: "PROJECT: Arcon",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.FACT,
        content: "Entity: Arcon",
        confidenceScore: 0.95,
        importanceScore: 5,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    assert.strictEqual(result.created, 0);
    assert.strictEqual(repository.listMemories().length, 0);
  });

  it("keeps meaningful identity, family, and project memories", () => {
    const result = pipeline.processCandidates([
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's self is Vedant",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's sister is Madhura",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.RELATIONSHIP,
        content: "User's building is Arcon",
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
      {
        type: MemoryType.FACT,
        content: "Arcon is being built",
        confidenceScore: 0.95,
        importanceScore: 7,
        sourceType: MemorySourceType.INFERRED,
        reasoning: "test",
      },
    ]);

    assert.strictEqual(result.created, 4);
    assert.deepStrictEqual(
      repository.listMemories().map((memory) => memory.content).sort(),
      [
        "Arcon is being built",
        "User's building is Arcon",
        "User's self is Vedant",
        "User's sister is Madhura",
      ].sort(),
    );
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
