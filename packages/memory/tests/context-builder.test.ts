import { describe, it } from "node:test";
import assert from "node:assert";

import {
  MemoryType,
  MemoryStatus,
  MemorySourceType,
  type Memory
} from "../src/personal-memory.js";

import { buildMemoryContext } from "../src/retrieval/context-builder.js";

function createMemory(
  type: MemoryType,
  content: string,
  status = MemoryStatus.ACTIVE
): Memory {
  return {
    id: "1",
    type,
    status,
    content,
    importanceScore: 5,
    confidenceScore: 0.9,
    sourceType: MemorySourceType.USER_EXPLICIT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    evidenceCount: 1
  };
}

describe("ContextBuilder", () => {
  it("handles empty memory list", () => {
    const result = buildMemoryContext([]);

    assert.strictEqual(result, "");
  });

  it("builds readable context", () => {
    const result = buildMemoryContext([
      createMemory(
        MemoryType.PROJECT,
        "User is building Arcon"
      ),
      createMemory(
        MemoryType.PREFERENCE,
        "User prefers TypeScript"
      )
    ]);

    assert(result.includes("[PROJECT]"));
    assert(result.includes("[PREFERENCE]"));
    assert(result.includes("Arcon"));
    assert(result.includes("TypeScript"));
  });

  it("ignores archived memories", () => {
    const result = buildMemoryContext([
      createMemory(
        MemoryType.PROJECT,
        "Visible Memory"
      ),
      createMemory(
        MemoryType.PROJECT,
        "Hidden Memory",
        MemoryStatus.ARCHIVED
      )
    ]);

    assert(result.includes("Visible Memory"));
    assert(!result.includes("Hidden Memory"));
  });
});