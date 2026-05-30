import {
  MemorySourceType,
  type MemoryType,
} from "../personal-memory.js";

import type {
  SemanticMemory,
} from "./semantic-types.js";

import type {
  MemoryCandidate,
} from "../extractor/candidate.js";

export function toMemoryCandidate(
  memory: SemanticMemory,
): MemoryCandidate {
  return {
    type: memory.type as MemoryType,
    content: memory.content,
    confidenceScore:
      memory.confidenceScore,
    importanceScore:
      memory.importanceScore,
    sourceType:
      MemorySourceType.INFERRED,
    reasoning:
      "Semantic extraction",
  };
}