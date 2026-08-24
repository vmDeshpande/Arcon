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

describe("Phase C Retrieval", () => {
  let repository: MemoryRepository;
  let retriever: MemoryRetriever;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");

    mkdirSync(tempDir, {
      recursive: true
    });

    const dbPath = join(
      tempDir,
      `phase-c-${Date.now()}-${Math.random()}.sqlite`
    );

    repository = new MemoryRepository(dbPath);
    retriever = new MemoryRetriever(repository);
  });

  it("retrieves relevant memory", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "User is named Vedant",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("Vedant", { minScore: 0 });

    assert(results.some((m) => m.content === "User is named Vedant"));
  });

  it("rejects irrelevant memory", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "User likes coffee",
      importanceScore: 1,
      confidenceScore: 0.1,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("Explain blockchain technology", { minScore: 20 });

    assert.strictEqual(results.length, 0);
  });

  it("rejects superseded memory even if highly similar", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "User prefers dark mode",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.SUPERSEDED
    });

    const results = retriever.retrieveWithThreshold("dark mode", { minScore: 0 });

    assert(results.every((m) => m.status !== MemoryStatus.SUPERSEDED));
  });

  it("rejects contradicted memory", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "User likes tea",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.CONTRADICTED
    });

    const results = retriever.retrieveWithThreshold("likes", { minScore: 0 });

    assert(results.every((m) => m.status !== MemoryStatus.CONTRADICTED));
  });

  it("rejects pending confirmation memory", () => {
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "User may like Rust",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.PENDING_CONFIRMATION
    });

    const results = retriever.retrieveWithThreshold("Rust", { minScore: 0 });

    assert(results.every((m) => m.status !== MemoryStatus.PENDING_CONFIRMATION));
  });

  it("does not leak project scope into user retrieval", () => {
    repository.createMemory({
      type: MemoryType.PROJECT,
      content: "Building Arcon",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.PROJECT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "User likes TypeScript",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.USER
    });

    const results = retriever.retrieveWithThreshold("TypeScript", { minScore: 0, scope: MemoryScope.USER });

    assert(results.some((m) => m.content === "User likes TypeScript"));
    assert(results.every((m) => m.scope !== MemoryScope.PROJECT));
  });

  it("selects entity-specific memory for correct entity", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Arcon is an AI",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.ARCON
    });

    const results = retriever.retrieveWithThreshold("Arcon", { minScore: 0, scope: MemoryScope.ARCON });

    assert(results.some((m) => m.content === "Arcon is an AI"));
  });

  it("rejects wrong entity memory", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Arcon is an AI",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      scope: MemoryScope.ARCON
    });

    const results = retriever.retrieveWithThreshold("Arcon", { minScore: 0, scope: MemoryScope.USER });

    assert(results.length === 0);
  });

  it("low confidence memory loses to stronger evidence", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "User likes programming",
      importanceScore: 5,
      confidenceScore: 0.3,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "User likes TypeScript",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("likes", { minScore: 0, limit: 1 });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].content, "User likes TypeScript");
  });

  it("recent relevant memory is ranked correctly", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Old fact",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Recent fact",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("fact", { minScore: 0, limit: 1 });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].content, "Recent fact");
  });

  it("old but highly important memory can still be retrieved", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Critical old fact",
      importanceScore: 10,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      updatedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Minor recent fact",
      importanceScore: 1,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("fact", { minScore: 0, limit: 1 });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].content, "Critical old fact");
  });

  it("allows empty retrieval", () => {
    const results = retriever.retrieveWithThreshold("nothing matches", { minScore: 0 });

    assert.strictEqual(results.length, 0);
  });

  it("weak matches below threshold return nothing", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "unrelated memory",
      importanceScore: 1,
      confidenceScore: 0.1,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("unrelated", { minScore: 50 });

    assert.strictEqual(results.length, 0);
  });

  it("enforces context budget", () => {
    for (let i = 0; i < 10; i++) {
      repository.createMemory({
        type: MemoryType.FACT,
        content: `Memory ${i}`,
        importanceScore: 5,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT
      });
    }

    const results = retriever.retrieveWithThreshold("Memory", { minScore: 0, limit: 3 });

    assert(results.length <= 3);
  });

  it("rejects archived memory when competing active memory exists", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Archived fact",
      importanceScore: 9,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.ARCHIVED
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Active fact",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("fact", { minScore: 0 });

    assert(results.every((m) => m.status !== MemoryStatus.ARCHIVED));
    assert(results.some((m) => m.content === "Active fact"));
  });

  it("rejects obsolete memory when competing active memory exists", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Obsolete fact",
      importanceScore: 9,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.OBSOLETE
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Active fact",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const results = retriever.retrieveWithThreshold("fact", { minScore: 0 });

    assert(results.every((m) => m.status !== MemoryStatus.OBSOLETE));
    assert(results.some((m) => m.content === "Active fact"));
  });

  it("returns zero memories when all candidates are invalid status", () => {
    repository.createMemory({
      type: MemoryType.FACT,
      content: "Superseded",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.SUPERSEDED
    });

    repository.createMemory({
      type: MemoryType.FACT,
      content: "Contradicted",
      importanceScore: 5,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_EXPLICIT,
      status: MemoryStatus.CONTRADICTED
    });

    const results = retriever.retrieveWithThreshold("fact", { minScore: 0 });

    assert.strictEqual(results.length, 0);
  });
});
