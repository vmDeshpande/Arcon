import {
  Memory,
  MemoryRepository,
  MemoryStatus
} from "../personal-memory.js";
import { calculateMemoryScore } from "./memory-ranking.js";

export class MemoryRetriever {
  constructor(private readonly repository: MemoryRepository) {}

  retrieveRelevantMemories(
    query: string,
    limit = 10
  ): Memory[] {
    const memories = this.repository
      .listMemories()
      .filter(
        (memory) =>
          memory.status !== MemoryStatus.ARCHIVED &&
          memory.status !== MemoryStatus.OBSOLETE
      );

    return memories
      .map((memory) => ({
        memory,
        score: calculateMemoryScore(memory, query)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }
}