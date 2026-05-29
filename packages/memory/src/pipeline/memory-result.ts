import type { Memory } from "../personal-memory.js";
import type { MemoryCandidate } from "../extractor/candidate.js";

export interface PipelineResult {
  created: number;
  updated: number;
  ignored: number;
  rejected: number;
  createdMemories: Memory[];
  updatedMemories: Memory[];
  rejectedCandidates: MemoryCandidate[];
}
