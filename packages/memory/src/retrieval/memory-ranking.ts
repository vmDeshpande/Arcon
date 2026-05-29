import { Memory, MemoryStatus } from "../personal-memory.js";

export function calculateMemoryScore(
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

  const relevanceScore = keywordMatches * 5;
  const importanceScore = memory.importanceScore * 2;
  const confidenceScore = memory.confidenceScore * 10;
  const evidenceScore = Math.min(memory.evidenceCount, 10);

  let recencyScore = 1;

  const ageDays =
    (Date.now() - new Date(memory.updatedAt).getTime()) /
    (1000 * 60 * 60 * 24);

  if (ageDays <= 7) {
    recencyScore = 10;
  } else if (ageDays <= 30) {
    recencyScore = 7;
  } else if (ageDays <= 90) {
    recencyScore = 4;
  }

  let statusBonus = 0;

  if (memory.status === MemoryStatus.ACTIVE) {
    statusBonus = 2;
  }

  return (
    relevanceScore +
    importanceScore +
    confidenceScore +
    evidenceScore +
    recencyScore +
    statusBonus
  );
}