import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemorySourceType,
  MemoryScope,
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

  it("excludes superseded memories from retrieval", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Old fact",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.SUPERSEDED
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Active fact",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results =
      retriever.retrieveRelevantMemories("fact");

    assert(
      results.every(
        (m) => m.status !== MemoryStatus.SUPERSEDED
      )
    );
    assert(results.some((m) => m.content === "Active fact"));
  });

  it("excludes contradicted memories from retrieval", () => {
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User likes coffee",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.CONTRADICTED
    });

    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User likes tea",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results =
      retriever.retrieveRelevantMemories("likes");

    assert(
      results.every(
        (m) => m.status !== MemoryStatus.CONTRADICTED
      )
    );
    assert(results.some((m) => m.content === "User likes tea"));
  });

  it("excludes pending confirmation memories from retrieval", () => {
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User may like Rust",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.PENDING_CONFIRMATION
    });

    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User likes TypeScript",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results =
      retriever.retrieveRelevantMemories("likes");

    assert(
      results.every(
        (m) => m.status !== MemoryStatus.PENDING_CONFIRMATION
      )
    );
    assert(results.some((m) => m.content === "User likes TypeScript"));
  });

  it("enforces MemoryScope during retrieval", () => {
    repository.createMemory({
      type: MemoryType.PROJECT,
      content: "Building a game",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.PROJECT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "User is named Vedant",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.USER
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Arcon uses AI",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.ARCON
    });

    const results =
      retriever.retrieveRelevantMemories("user fact");

    assert(results.some((m) => m.content === "User is named Vedant"));
    assert(results.some((m) => m.content === "Arcon uses AI"));
    assert(
      results.every(
        (m) => m.scope !== MemoryScope.PROJECT
      )
    );
  });

  it("updates last_used_at on every retrieval", async () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Memory to track usage",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    retriever.retrieveRelevantMemories("track usage");
    const firstUsedAt = repository.listMemories({
      type: MemoryType.FACT,
      content: "Memory to track usage"
    })[0]?.lastUsedAt;

    assert(firstUsedAt !== undefined);

    await new Promise((resolve) => setTimeout(resolve, 10));

    retriever.retrieveRelevantMemories("track usage");
    const secondUsedAt = repository.listMemories({
      type: MemoryType.FACT,
      content: "Memory to track usage"
    })[0]?.lastUsedAt;

    assert(secondUsedAt !== undefined);
    assert(secondUsedAt !== firstUsedAt);
  });
});