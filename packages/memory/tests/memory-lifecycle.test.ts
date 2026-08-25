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

import { MemoryPipeline } from "../src/pipeline/memory-pipeline.js";
import { MemoryRetriever } from "../src/retrieval/memory-retriever.js";
import { EntityRepository } from "../src/entity/entity-repository.js";
import { EntityFactRepository } from "../src/entity/entity-fact-repository.js";

describe("Memory Lifecycle Hardening", () => {
  let repository: MemoryRepository;
  let pipeline: MemoryPipeline;
  let retriever: MemoryRetriever;
  let databasePath: string;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");
    mkdirSync(tempDir, { recursive: true });

    databasePath = join(
      tempDir,
      `lifecycle-${Date.now()}-${Math.random()}.sqlite`,
    );

    repository = new MemoryRepository(databasePath);
    pipeline = new MemoryPipeline(repository);
    retriever = new MemoryRetriever(repository);
  });

  describe("PENDING_CONFIRMATION resolution", () => {
    it("confirms a pending memory and makes it active", async () => {
      repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User may like Rust",
        importanceScore: 5,
        confidenceScore: 0.5,
        sourceType: MemorySourceType.INFERRED,
        status: MemoryStatus.PENDING_CONFIRMATION,
      });

      const confirmed = await pipeline.confirmPendingMemory(
        repository.listMemories({ status: MemoryStatus.PENDING_CONFIRMATION })[0].id
      );

      assert.ok(confirmed, "expected confirmation to succeed");
      assert.strictEqual(confirmed.status, MemoryStatus.ACTIVE);
      assert.strictEqual(confirmed.sourceType, MemorySourceType.USER_CONFIRMED);
    });

    it("rejects a pending memory and marks it obsolete", async () => {
      const pending = repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User may like Rust",
        importanceScore: 5,
        confidenceScore: 0.5,
        sourceType: MemorySourceType.INFERRED,
        status: MemoryStatus.PENDING_CONFIRMATION,
      });

      const rejected = await pipeline.rejectPendingMemory(pending.id);

      assert.ok(rejected, "expected rejection to succeed");
      assert.strictEqual(rejected.status, MemoryStatus.OBSOLETE);
    });

    it("excludes pending memories from normal retrieval", async () => {
      repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User may like Rust",
        importanceScore: 5,
        confidenceScore: 0.5,
        sourceType: MemorySourceType.INFERRED,
        status: MemoryStatus.PENDING_CONFIRMATION,
      });

      repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User likes TypeScript",
        importanceScore: 5,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const results = retriever.retrieveWithThreshold("likes", { minScore: 0 });

      assert(results.every((m) => m.status !== MemoryStatus.PENDING_CONFIRMATION));
      assert(results.some((m) => m.content === "User likes TypeScript"));
    });

    it("preserves lineage when confirming pending memory", async () => {
      repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User may like Rust",
        importanceScore: 5,
        confidenceScore: 0.5,
        sourceType: MemorySourceType.INFERRED,
        status: MemoryStatus.PENDING_CONFIRMATION,
      });

      const pending = repository.listMemories({ status: MemoryStatus.PENDING_CONFIRMATION })[0];
      const confirmed = await pipeline.confirmPendingMemory(pending.id);

      assert.ok(confirmed);
      assert.strictEqual(confirmed.id, pending.id, "confirmation should preserve identity");
    });

    it("does not corrupt lineage on repeated confirmation", async () => {
      const pending = repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User may like Rust",
        importanceScore: 5,
        confidenceScore: 0.5,
        sourceType: MemorySourceType.INFERRED,
        status: MemoryStatus.PENDING_CONFIRMATION,
      });

      await pipeline.confirmPendingMemory(pending.id);
      const second = await pipeline.confirmPendingMemory(pending.id);

      assert.ok(second);
      assert.strictEqual(second.id, pending.id);
      assert.strictEqual(second.status, MemoryStatus.ACTIVE);
    });
  });

  describe("CONTRADICTED state", () => {
    it("marks a memory as contradicted", async () => {
      const memory = repository.createMemory({
        type: MemoryType.FACT,
        content: "User uses JavaScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const contradicted = await pipeline.markMemoryContradicted(memory.id);

      assert.ok(contradicted);
      assert.strictEqual(contradicted.status, MemoryStatus.CONTRADICTED);
    });

    it("excludes contradicted memories from retrieval", async () => {
      repository.createMemory({
        type: MemoryType.FACT,
        content: "User uses JavaScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        status: MemoryStatus.CONTRADICTED,
      });

      repository.createMemory({
        type: MemoryType.FACT,
        content: "User uses TypeScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const results = retriever.retrieveWithThreshold("uses", { minScore: 0 });

      assert(results.every((m) => m.status !== MemoryStatus.CONTRADICTED));
      assert(results.some((m) => m.content === "User uses TypeScript"));
    });

    it("resolves contradiction by keeping memory active", async () => {
      const memory = repository.createMemory({
        type: MemoryType.FACT,
        content: "User uses JavaScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      await pipeline.markMemoryContradicted(memory.id);
      const resolved = await pipeline.resolveContradiction(memory.id, true);

      assert.ok(resolved);
      assert.strictEqual(resolved.status, MemoryStatus.ACTIVE);
    });

    it("resolves contradiction by marking obsolete", async () => {
      const memory = repository.createMemory({
        type: MemoryType.FACT,
        content: "User uses JavaScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      await pipeline.markMemoryContradicted(memory.id);
      const resolved = await pipeline.resolveContradiction(memory.id, false);

      assert.ok(resolved);
      assert.strictEqual(resolved.status, MemoryStatus.OBSOLETE);
    });
  });

  describe("PROJECT scope write path", () => {
    it("creates a memory with PROJECT scope when specified", async () => {
      const result = await pipeline.processCandidates([
        {
          type: MemoryType.PROJECT,
          content: "Building Arcon",
          confidenceScore: 0.9,
          importanceScore: 8,
          sourceType: MemorySourceType.USER_EXPLICIT,
          scope: MemoryScope.PROJECT,
          reasoning: "test",
        },
      ]);

      assert.strictEqual(result.created, 1);
      const memory = result.createdMemories[0];
      assert.strictEqual(memory.scope, MemoryScope.PROJECT);
    });

    it("retrieves project-scoped memories when scope is PROJECT", async () => {
      repository.createMemory({
        type: MemoryType.PROJECT,
        content: "Building Arcon",
        importanceScore: 8,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        scope: MemoryScope.PROJECT,
      });

      repository.createMemory({
        type: MemoryType.PROJECT,
        content: "Building a game",
        importanceScore: 8,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        scope: MemoryScope.PROJECT,
      });

      const results = retriever.retrieveWithThreshold("Arcon", {
        scope: MemoryScope.PROJECT,
        minScore: 0,
      });

      assert(results.some((m) => m.content === "Building Arcon"));
      assert(results.every((m) => m.scope === MemoryScope.PROJECT));
    });

    it("isolates Project A from Project B memories", async () => {
      repository.createMemory({
        type: MemoryType.PROJECT,
        content: "Building Project A",
        importanceScore: 8,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        scope: MemoryScope.PROJECT,
        subject: "Project A",
      });

      repository.createMemory({
        type: MemoryType.PROJECT,
        content: "Building Project B",
        importanceScore: 8,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        scope: MemoryScope.PROJECT,
        subject: "Project B",
      });

      const resultsA = retriever.retrieveWithThreshold("Project A", {
        scope: MemoryScope.PROJECT,
        minScore: 0,
      });

      const resultsB = retriever.retrieveWithThreshold("Project B", {
        scope: MemoryScope.PROJECT,
        minScore: 0,
      });

      assert(resultsA.some((m) => m.content === "Building Project A"));
      assert(resultsB.some((m) => m.content === "Building Project B"));
    });
  });

  describe("Entity + general memory retrieval", () => {
    it("returns entity memories alongside general memories", async () => {
      const entityRepo = new EntityRepository(databasePath.replace(".sqlite", "-entities.sqlite"));
      const factRepo = new EntityFactRepository(entityRepo["db"]);
      const retrieverWithEntity = new MemoryRetriever(repository, entityRepo, factRepo);

      repository.createMemory({
        type: MemoryType.FACT,
        content: "User likes TypeScript",
        importanceScore: 5,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const results = retrieverWithEntity.retrieveRelevantMemories("User");

      assert(results.some((m) => m.content === "User likes TypeScript"));
    });

    it("does not suppress general context when entity match exists", async () => {
      const entityRepo = new EntityRepository(databasePath.replace(".sqlite", "-entities.sqlite"));
      const factRepo = new EntityFactRepository(entityRepo["db"]);
      const retrieverWithEntity = new MemoryRetriever(repository, entityRepo, factRepo);

      repository.createMemory({
        type: MemoryType.FACT,
        content: "User is building Arcon",
        importanceScore: 8,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      entityRepo.createEntity("Arcon", "PROJECT");

      const results = retrieverWithEntity.retrieveRelevantMemories("Arcon");

      assert(results.some((m) => m.content === "User is building Arcon"));
    });
  });

  describe("Rejected-value protection", () => {
    it("does not recreate a superseded value from re-extraction", async () => {
      repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User prefers Java for backend development",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const supersedeResult = await pipeline.processCandidates([
        {
          type: MemoryType.PREFERENCE,
          content: "User changed from Java to Kotlin for backend development",
          confidenceScore: 0.95,
          importanceScore: 8,
          sourceType: MemorySourceType.INFERRED,
          reasoning: "test",
        },
      ]);

      assert.strictEqual(supersedeResult.superseded, 1);

      const reextractResult = await pipeline.processCandidates([
        {
          type: MemoryType.PREFERENCE,
          content: "User prefers Java for backend development",
          confidenceScore: 0.9,
          importanceScore: 6,
          sourceType: MemorySourceType.INFERRED,
          reasoning: "reextraction",
        },
      ]);

      assert.strictEqual(reextractResult.ignored, 1);
      assert.strictEqual(reextractResult.created, 0);
    });
  });

  describe("Retrieval ranking edge cases", () => {
    it("rejects high-importance irrelevant memory", async () => {
      repository.createMemory({
        type: MemoryType.FACT,
        content: "User likes coffee",
        importanceScore: 10,
        confidenceScore: 1.0,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const results = retriever.retrieveWithThreshold("Explain quantum computing", { minScore: 20 });

      assert.strictEqual(results.length, 0);
    });

    it("rejects high-confidence irrelevant memory", async () => {
      repository.createMemory({
        type: MemoryType.FACT,
        content: "User likes coffee",
        importanceScore: 5,
        confidenceScore: 1.0,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const results = retriever.retrieveWithThreshold("Explain quantum computing", { minScore: 15 });

      assert.strictEqual(results.length, 0);
    });

    it("returns empty for empty database", async () => {
      const results = retriever.retrieveWithThreshold("anything", { minScore: 0 });
      assert.strictEqual(results.length, 0);
    });
  });
});
