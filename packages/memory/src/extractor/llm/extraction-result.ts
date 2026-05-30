import { MemoryType } from "../../personal-memory.js";

export interface LlmMemoryCandidate {
  type: MemoryType;
  content: string;
  confidenceScore: number;
}