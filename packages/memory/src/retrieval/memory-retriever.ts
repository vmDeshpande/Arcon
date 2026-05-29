import {
  Memory,
  MemoryRepository,
  MemoryStatus
} from "../personal-memory.js";

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
        score: this.scoreMemory(memory, query)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  scoreMemory(
    memory: Memory,
    query: string
  ): number {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const content = memory.content.toLowerCase();

    let keywordMatches = 0;

    for (const word of queryWords) {
      if (content.includes(word)) {
        keywordMatches++;
      }
    }

    let score =
      keywordMatches * 5 +
      memory.importanceScore +
      memory.confidenceScore * 10;

    if (memory.status === MemoryStatus.ACTIVE) {
      score += 2;
    }

    return score;
  }
}