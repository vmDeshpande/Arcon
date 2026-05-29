import { describe, it } from "node:test";
import assert from "node:assert";

import {
  MemoryType,
  MemoryStatus,
  MemorySourceType
} from "../src/personal-memory.js";

import { calculateMemoryScore } from "../src/retrieval/memory-ranking.js";

describe("MemoryRanking", () => {
  it("gives higher score to important memories", () => {
    const low = calculateMemoryScore(
      {
        id: "1",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 2,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        evidenceCount: 1
      },
      "linux"
    );

    const high = calculateMemoryScore(
      {
        id: "2",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 9,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        evidenceCount: 1
      },
      "linux"
    );

    assert(high > low);
  });

  it("rewards evidence count", () => {
    const low = calculateMemoryScore(
      {
        id: "1",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 5,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        evidenceCount: 1
      },
      "linux"
    );

    const high = calculateMemoryScore(
      {
        id: "2",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 5,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        evidenceCount: 8
      },
      "linux"
    );

    assert(high > low);
  });

  it("rewards recent memories", () => {
    const recent = calculateMemoryScore(
      {
        id: "1",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 5,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        evidenceCount: 1
      },
      "linux"
    );

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 180);

    const old = calculateMemoryScore(
      {
        id: "2",
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
        content: "User uses Linux",
        importanceScore: 5,
        confidenceScore: 0.8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        tags: [],
        evidenceCount: 1
      },
      "linux"
    );

    assert(recent > old);
  });
});