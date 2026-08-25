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

  const relevanceScore = keywordMatches * 10;
  const importanceScore = memory.importanceScore;
  const confidenceScore = memory.confidenceScore * 5;
  const evidenceScore = Math.min(memory.evidenceCount, 5);

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

  const excludedStatuses = new Set([
    MemoryStatus.OBSOLETE,
    MemoryStatus.CONTRADICTED,
    MemoryStatus.PENDING_CONFIRMATION,
    MemoryStatus.SUPERSEDED,
  ]);

  const statusPenalty = excludedStatuses.has(memory.status) ? -50 : 0;

  const irrelevancePenalty = keywordMatches === 0 ? -1000 : 0;

  return (
    relevanceScore +
    importanceScore +
    confidenceScore +
    evidenceScore +
    recencyScore +
    statusBonus +
    statusPenalty +
    irrelevancePenalty
  );
}