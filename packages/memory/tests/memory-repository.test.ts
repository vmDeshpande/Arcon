import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  MemoryRepository,
  MemorySourceType,
  MemoryStatus,
  MemoryType,
  MemoryValidationError
} from "../src/index.js";

let tempDir: string;
let repository: MemoryRepository;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "arcon-memory-"));
  repository = new MemoryRepository(join(tempDir, "memory.sqlite"));
});

afterEach(() => {
  repository.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("MemoryRepository", () => {
  test("creates and reads a memory", () => {
    const memory = repository.createMemory({
      type: MemoryType.PROJECT,
      content: "The user is building Arcon.",
      importanceScore: 8,
      confidenceScore: 0.95,
      sourceType: MemorySourceType.USER_EXPLICIT,
      subject: "Arcon",
      tags: ["project", " arcon ", "project"]
    });

    const stored = repository.getMemoryById(memory.id);

    assert.equal(stored?.id, memory.id);
    assert.equal(stored?.type, MemoryType.PROJECT);
    assert.equal(stored?.status, MemoryStatus.ACTIVE);
    assert.equal(stored?.content, "The user is building Arcon.");
    assert.equal(stored?.importanceScore, 8);
    assert.equal(stored?.confidenceScore, 0.95);
    assert.equal(stored?.sourceType, MemorySourceType.USER_EXPLICIT);
    assert.equal(stored?.subject, "Arcon");
    assert.deepEqual(stored?.tags, ["project", "arcon"]);
    assert.equal(stored?.evidenceCount, 1);
  });

  test("updates a memory", () => {
    const memory = repository.createMemory({
      type: MemoryType.FACT,
      content: "The user uses JavaScript.",
      importanceScore: 5,
      confidenceScore: 0.7,
      sourceType: MemorySourceType.INFERRED
    });

    const updated = repository.updateMemory(memory.id, {
      type: MemoryType.PREFERENCE,
      content: "The user prefers TypeScript.",
      importanceScore: 7,
      confidenceScore: 0.9,
      sourceType: MemorySourceType.USER_CONFIRMED,
      tags: ["typescript"]
    });

    assert.equal(updated?.id, memory.id);
    assert.equal(updated?.type, MemoryType.PREFERENCE);
    assert.equal(updated?.content, "The user prefers TypeScript.");
    assert.equal(updated?.importanceScore, 7);
    assert.equal(updated?.confidenceScore, 0.9);
    assert.equal(updated?.sourceType, MemorySourceType.USER_CONFIRMED);
    assert.deepEqual(updated?.tags, ["typescript"]);
    assert.ok(Date.parse(updated?.updatedAt ?? "") >= Date.parse(memory.updatedAt));
  });

  test("archives a memory", () => {
    const memory = repository.createMemory({
      type: MemoryType.GOAL,
      content: "The user wants Phase 2 reviewed before implementation.",
      importanceScore: 7,
      confidenceScore: 1,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    const archived = repository.archiveMemory(memory.id);

    assert.equal(archived?.status, MemoryStatus.ARCHIVED);
    assert.equal(repository.getMemoryById(memory.id)?.status, MemoryStatus.ARCHIVED);
  });

  test("deletes a memory", () => {
    const memory = repository.createMemory({
      type: MemoryType.FACT,
      content: "The user works locally.",
      importanceScore: 4,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });

    assert.equal(repository.deleteMemory(memory.id), true);
    assert.equal(repository.getMemoryById(memory.id), null);
    assert.equal(repository.deleteMemory(memory.id), false);
  });

  test("filters memories by type and status", () => {
    repository.createMemory({
      type: MemoryType.PROJECT,
      content: "Arcon Phase 1 is complete.",
      importanceScore: 8,
      confidenceScore: 1,
      sourceType: MemorySourceType.USER_EXPLICIT
    });
    repository.createMemory({
      type: MemoryType.PREFERENCE,
      content: "The user prefers concise responses.",
      importanceScore: 6,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.USER_EXPLICIT
    });
    repository.createMemory({
      type: MemoryType.PROJECT,
      status: MemoryStatus.ARCHIVED,
      content: "An old project phase is archived.",
      importanceScore: 5,
      confidenceScore: 0.8,
      sourceType: MemorySourceType.SYSTEM_OBSERVED
    });

    assert.equal(repository.listMemories({ type: MemoryType.PROJECT }).length, 2);
    assert.equal(repository.listMemories({ status: MemoryStatus.ACTIVE }).length, 2);
    assert.equal(repository.listMemories({ type: MemoryType.PROJECT, status: MemoryStatus.ACTIVE }).length, 1);
  });

  test("rejects invalid records", () => {
    assert.throws(
      () =>
        repository.createMemory({
          type: MemoryType.FACT,
          content: "",
          importanceScore: 5,
          confidenceScore: 0.8,
          sourceType: MemorySourceType.USER_EXPLICIT
        }),
      MemoryValidationError
    );

    assert.throws(
      () =>
        repository.createMemory({
          type: MemoryType.FACT,
          content: "Invalid importance.",
          importanceScore: 11,
          confidenceScore: 0.8,
          sourceType: MemorySourceType.USER_EXPLICIT
        }),
      MemoryValidationError
    );

    assert.throws(
      () =>
        repository.createMemory({
          type: MemoryType.FACT,
          content: "Invalid confidence.",
          importanceScore: 5,
          confidenceScore: 1.1,
          sourceType: MemorySourceType.USER_EXPLICIT
        }),
      MemoryValidationError
    );
  });
});
