import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemorySourceType
} from "../src/personal-memory.js";

import { MemoryRetriever } from "../src/retrieval/memory-retriever.js";

describe("MemoryRetriever", () => {
  let repository: MemoryRepository;
  let retriever: MemoryRetriever;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");

    mkdirSync(tempDir, {
      recursive: true
    });

    const dbPath = join(
      tempDir,
      `retriever-${Date.now()}-${Math.random()}.sqlite`
    );

    repository = new MemoryRepository(dbPath);
    retriever = new MemoryRetriever(repository);
  });

  it("retrieves matching memories", () => {
    repository.createMemory({
      type: MemoryType.PROJECT,
      content: "User is building Arcon",
      importanceScore: 8,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results =
      retriever.retrieveRelevantMemories("Arcon");

    assert(results.length > 0);
    assert(results[0].content.includes("Arcon"));
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 20; i++) {
      repository.createMemory({
        type: MemoryType.FACT,
        content: `Memory ${i}`,
        importanceScore: 5,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT
      });
    }

    const results =
      retriever.retrieveRelevantMemories(
        "memory",
        5
      );

    assert.strictEqual(results.length, 5);
  });

  it("ignores archived memories", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Active memory",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Archived memory",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.ARCHIVED
    });

    const results =
      retriever.retrieveRelevantMemories("memory");

    assert(
      results.every(
        (m) => m.status !== MemoryStatus.ARCHIVED
      )
    );
  });

  it("ranks higher importance memories first", () => {
    repository.createMemory({
      type: MemoryType.PROJECT,
      content: "Arcon project",
      importanceScore: 9,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Arcon note",
      importanceScore: 2,
      confidenceScore: 0.5,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results =
      retriever.retrieveRelevantMemories("Arcon");

    assert(results.length >= 2);

    assert(
      results[0].importanceScore >=
      results[1].importanceScore
    );
  });
});