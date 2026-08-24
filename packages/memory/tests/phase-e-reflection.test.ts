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
import { ReflectionEngine } from "../src/reflection/reflection-engine.js";
import { ReflectionProcessor } from "../src/reflection/reflection-processor.js";
import { ReflectionTrigger } from "../src/reflection/reflection-trigger.js";
import type { ReflectionExperience, ReflectionCandidate } from "../src/reflection/reflection-candidate.js";

describe("Phase E: Reflection", () => {
  let repository: MemoryRepository;
  let pipeline: MemoryPipeline;
  let engine: ReflectionEngine;
  let processor: ReflectionProcessor;
  let trigger: ReflectionTrigger;
  let databasePath: string;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");
    mkdirSync(tempDir, { recursive: true });

    databasePath = join(tempDir, `reflection-${Date.now()}-${Math.random()}.sqlite`);

    repository = new MemoryRepository(databasePath);
    pipeline = new MemoryPipeline(repository);
    engine = new ReflectionEngine(repository);
    processor = new ReflectionProcessor(pipeline, repository);
    trigger = new ReflectionTrigger(processor, engine);
  });

  describe("ReflectionEngine", () => {
    it("does not produce a candidate from a single weak experience", async () => {
      const experiences: ReflectionExperience[] = [
        {
          id: "exp-1",
          type: "USER_SHARED_PREFERENCE",
          count: 1,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        },
      ];

      const candidates = await engine.reflect(experiences);
      assert.strictEqual(candidates.length, 0);
    });

    it("produces a reflection candidate from repeated consistent experiences", async () => {
      const baseTime = new Date().toISOString();
      const experiences: ReflectionExperience[] = [
        {
          id: "exp-1",
          type: "USER_SHARED_PREFERENCE",
          count: 3,
          firstSeen: baseTime,
          lastSeen: baseTime,
        },
      ];

      const candidates = await engine.reflect(experiences);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].proposalType, "CREATE");
      assert.strictEqual(candidates[0].memoryType, MemoryType.PREFERENCE);
      assert.ok(candidates[0].evidence.length > 0);
    });

    it("includes provenance evidence in reflection candidates", async () => {
      const baseTime = new Date().toISOString();
      const experiences: ReflectionExperience[] = [
        {
          id: "exp-1",
          type: "USER_SHARED_PREFERENCE",
          count: 3,
          firstSeen: baseTime,
          lastSeen: baseTime,
          context: "User said they like TypeScript",
        },
      ];

      const candidates = await engine.reflect(experiences);
      assert.strictEqual(candidates.length, 1);
      assert.ok(candidates[0].evidence.length > 0);
      assert.strictEqual(candidates[0].evidence[0].experienceType, "USER_SHARED_PREFERENCE");
      assert.strictEqual(candidates[0].evidence[0].count, 3);
      assert.strictEqual(candidates[0].evidence[0].context, "User said they like TypeScript");
    });

    it("produces NO_OP for experiences below threshold", async () => {
      const experiences: ReflectionExperience[] = [
        {
          id: "exp-1",
          type: "USER_SHARED_PROJECT",
          count: 1,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        },
      ];

      const candidates = await engine.reflect(experiences);
      assert.strictEqual(candidates.length, 0);
    });
  });

  describe("ReflectionProcessor", () => {
    it("routes CREATE proposals through MemoryPipeline", async () => {
      const candidate: ReflectionCandidate = {
        proposalType: "CREATE",
        memoryType: MemoryType.PREFERENCE,
        content: "User prefers concise answers",
        confidence: 0.9,
        importance: 5,
        reason: "Test",
        evidence: [],
        scope: MemoryScope.USER,
      };

      const result = await processor.process([candidate]);
      assert.strictEqual(result.proposed, 1);
      assert.strictEqual(result.noOp, 0);

      const memories = repository.listMemories({ type: MemoryType.PREFERENCE });
      assert.strictEqual(memories.length, 1);
      assert.strictEqual(memories[0].content, "User prefers concise answers");
    });

    it("rejects CREATE proposals with missing scope", async () => {
      const candidate = {
        proposalType: "CREATE",
        memoryType: MemoryType.PREFERENCE,
        content: "User prefers concise answers",
        confidence: 0.9,
        importance: 5,
        reason: "Test",
        evidence: [],
      } as ReflectionCandidate;

      const result = await processor.process([candidate]);
      assert.strictEqual(result.proposed, 0);
      assert.strictEqual(result.rejected, 1);
    });

    it("does not modify unrelated memories", async () => {
      await pipeline.processMessage("My favorite language is TypeScript");

      const unrelatedCandidate: ReflectionCandidate = {
        proposalType: "UPDATE",
        memoryType: MemoryType.FACT,
        content: "Unrelated fact",
        confidence: 0.9,
        importance: 5,
        reason: "Test",
        evidence: [],
        affectedMemoryId: "non-existent-id",
        scope: MemoryScope.USER,
      };

      const result = await processor.process([unrelatedCandidate]);
      assert.strictEqual(result.proposed, 0);
      assert.strictEqual(result.rejected, 1);

      const memories = repository.listMemories({ type: MemoryType.PREFERENCE });
      assert.strictEqual(memories.length, 1);
      assert.ok(memories[0].content.includes("TypeScript"));
    });

    it("does not block normal response generation", async () => {
      const start = Date.now();
      const candidates: ReflectionCandidate[] = Array.from({ length: 100 }, (_, i) => ({
        proposalType: "NO_OP" as const,
        memoryType: MemoryType.PREFERENCE,
        content: `Test ${i}`,
        confidence: 0.9,
        importance: 5,
        reason: "Test",
        evidence: [],
        scope: MemoryScope.USER,
      }));

      await processor.process(candidates);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 1000, `Reflection took ${elapsed}ms, expected < 1000ms`);
    });
  });

  describe("ReflectionTrigger", () => {
    it("does not flush when below threshold", async () => {
      const result = await trigger.flush();
      assert.strictEqual(result.processed, 0);
    });

    it("flushes when threshold is reached", async () => {
      for (let i = 0; i < 5; i++) {
        const shouldFlush = trigger.addExperience({
          id: `exp-${i}`,
          type: "USER_SHARED_PREFERENCE",
          count: 1,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });
        assert.strictEqual(shouldFlush, i === 4);
      }

      const result = await trigger.flush();
      assert.strictEqual(result.processed, 1);
    });

    it("resets pending experiences after flush", async () => {
      trigger.addExperience({
        id: "exp-1",
        type: "USER_SHARED_PREFERENCE",
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });

      await trigger.flush();
      assert.strictEqual(trigger.pendingCount, 0);
    });
  });

  describe("Memory lifecycle preservation", () => {
    it("does not silently delete historical memories", async () => {
      const created = repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User likes TypeScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });
      const before = repository.listMemories();
      assert.strictEqual(before.length, 1);

      const candidate: ReflectionCandidate = {
        proposalType: "NO_OP",
        memoryType: MemoryType.PREFERENCE,
        content: "No change",
        confidence: 0.9,
        importance: 5,
        reason: "Test",
        evidence: [],
        scope: MemoryScope.USER,
      };

      await processor.process([candidate]);
      const after = repository.listMemories();
      assert.strictEqual(after.length, 1);
      assert.strictEqual(after[0].id, created.id);
    });

    it("preserves lineage through supersession", async () => {
      const original = repository.createMemory({
        type: MemoryType.PREFERENCE,
        content: "User prefers TypeScript",
        importanceScore: 6,
        confidenceScore: 0.9,
        sourceType: MemorySourceType.USER_EXPLICIT,
      });

      const supersedingContent = "User prefers Python instead of TypeScript";
      const candidate: ReflectionCandidate = {
        proposalType: "SUPERSEDE",
        memoryType: MemoryType.PREFERENCE,
        content: supersedingContent,
        confidence: 0.9,
        importance: 5,
        reason: "User changed preference",
        evidence: [],
        affectedMemoryId: original.id,
        scope: MemoryScope.USER,
      };

      const result = await processor.process([candidate]);
      assert.strictEqual(result.proposed, 1);

      const memories = repository.listMemories({ type: MemoryType.PREFERENCE });
      const active = memories.filter((m) => m.status === MemoryStatus.ACTIVE);
      const superseded = memories.filter((m) => m.status === MemoryStatus.SUPERSEDED);

      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].content, supersedingContent);
      assert.strictEqual(superseded.length, 1);
      assert.strictEqual(superseded[0].id, original.id);
    });
  });
});
