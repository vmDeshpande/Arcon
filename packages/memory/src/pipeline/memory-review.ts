import { MemoryType, MemoryStatus } from "../personal-memory.js";
import type { Memory } from "../personal-memory.js";
import type { MemoryCandidate } from "../extractor/candidate.js";
import { normalizeRelationshipContent } from "../entity/entity-relationship-extractor.js";
import { extractDomain } from "./memory-domain.js";

export type MemoryReviewDecision = "CREATE" | "UPDATE" | "IGNORE" | "CONFLICT" | "SUPERSEDE";

export interface MemoryReview {
  decision: MemoryReviewDecision;
  targetMemory?: Memory;
  originalMessage?: string;
}

const STOPWORDS = new Set([
  "user",
  "users",
  "the",
  "is",
  "are",
  "and",
  "to",
  "for",
  "with",
  "a",
  "an",
  "my",
  "their",
  "its",
  "of",
  "on",
  "in",
  "it",
  "i",
  "me",
  "be",
  "that",
  "this",
  "not",
  "have",
  "has",
  "do",
  "does",
  "did",
  "from",
  "as",
  "at",
  "by",
  "was",
  "were",
  "been",
  "being",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "cannot",
  "here",
  "there",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "than",
  "too",
  "very",
  "just",
  "because",
  "but",
  "or",
  "nor",
  "so",
  "yet",
  "if",
  "then",
  "else",
  "when",
  "while",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
  "here",
  "there",
  "now",
  "only",
  "own",
  "same",
  "she",
  "he",
  "her",
  "him",
  "his",
  "hers",
  "its",
  "they",
  "them",
  "their",
  "theirs",
  "we",
  "us",
  "our",
  "ours",
  "you",
  "your",
  "yours",
]);

const PREFERENCE_ROOT_WORDS = new Set(["prefer", "prefers", "like", "likes", "dislike", "dislikes", "favorite"]);

export function reviewCandidate(candidate: MemoryCandidate, existingMemories: Memory[], originalMessage?: string): MemoryReview {
  const relevant = existingMemories.filter((memory) => memory.type === candidate.type);

  const exactMatch = relevant.find((memory) => normalizeContent(memory.content) === normalizeContent(candidate.content));
  if (exactMatch) {
    return {
      decision: "IGNORE",
      targetMemory: exactMatch,
      originalMessage,
    };
  }

  const bestMatch = findBestMatch(candidate, relevant);

  if (bestMatch && isSupersession(candidate, bestMatch.memory, originalMessage)) {
    return {
      decision: "SUPERSEDE",
      targetMemory: bestMatch.memory,
      originalMessage,
    };
  }

  const candidateDomain = candidate.domain ?? extractDomain(candidate.content);
  const memoryDomain = bestMatch?.memory ? extractDomain(bestMatch.memory.content) : null;
  const sameDomain = candidateDomain && memoryDomain && candidateDomain === memoryDomain && candidateDomain !== "general";

  if (!bestMatch && originalMessage && hasReplacementIndicator(originalMessage)) {
    const supersessionTarget = findSupersessionTargetByOriginalMessage(candidate, relevant, originalMessage);
    if (supersessionTarget) {
      return {
        decision: "SUPERSEDE",
        targetMemory: supersessionTarget,
        originalMessage,
      };
    }
  }

  if (!bestMatch && originalMessage && hasReplacementIndicator(originalMessage)) {
    const crossTypeTarget = findCrossTypeSupersessionTarget(candidate, existingMemories);
    if (crossTypeTarget) {
      return {
        decision: "SUPERSEDE",
        targetMemory: crossTypeTarget,
        originalMessage,
      };
    }
  }

  if (bestMatch && !sameDomain && originalMessage && hasReplacementIndicator(originalMessage)) {
    const crossTypeTarget = findCrossTypeSupersessionTarget(candidate, existingMemories);
    if (crossTypeTarget) {
      return {
        decision: "SUPERSEDE",
        targetMemory: crossTypeTarget,
        originalMessage,
      };
    }
  }

  const preferenceConflict = findPreferenceConflict(candidate, relevant);
  if (preferenceConflict) {
    return {
      decision: "CONFLICT",
      targetMemory: preferenceConflict,
      originalMessage,
    };
  }

  if (!bestMatch) {
    const crossTypeTarget = findCrossTypeSupersessionTarget(candidate, existingMemories);
    if (crossTypeTarget) {
      return {
        decision: "SUPERSEDE",
        targetMemory: crossTypeTarget,
        originalMessage,
      };
    }

    const crossTypeConflict = findCrossTypePreferenceConflict(candidate, existingMemories);
    if (crossTypeConflict) {
      return {
        decision: "CONFLICT",
        targetMemory: crossTypeConflict,
        originalMessage,
      };
    }

    return { decision: "CREATE", originalMessage };
  }

  if (isConflict(candidate, bestMatch.memory)) {
    return {
      decision: "CONFLICT",
      targetMemory: bestMatch.memory,
      originalMessage,
    };
  }

  if (bestMatch.similarity >= 0.75) {
    return {
      decision: "UPDATE",
      targetMemory: bestMatch.memory,
      originalMessage,
    };
  }

  return { decision: "CREATE", originalMessage };
}

interface MatchResult {
  memory: Memory;
  similarity: number;
}

function findBestMatch(candidate: MemoryCandidate, memories: Memory[]): MatchResult | undefined {
  let bestMatch: MatchResult | undefined;

  for (const memory of memories) {
    const similarity = calculateSimilarity(candidate.content, memory.content);
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { memory, similarity };
    }
  }

  if (!bestMatch || bestMatch.similarity < 0.5) {
    return undefined;
  }

  return bestMatch;
}

function isConflict(candidate: MemoryCandidate, memory: Memory): boolean {
  const candidateDomain = candidate.domain ?? extractDomain(candidate.content);
  const memoryDomain = extractDomain(memory.content);

  const sameDomain = candidateDomain && memoryDomain && candidateDomain === memoryDomain && candidateDomain !== "general";

  if (candidate.type === MemoryType.PREFERENCE && memory.type === MemoryType.PREFERENCE) {
    const similarity = calculateSimilarity(candidate.content, memory.content);
    if (similarity < 0.35 || similarity >= 0.9) {
      return false;
    }

    const candidatePreference = extractPreferenceDetails(candidate.content);
    const memoryPreference = extractPreferenceDetails(memory.content);

    if (!candidatePreference || !memoryPreference) {
      return false;
    }

    if (candidatePreference.target && memoryPreference.target && candidatePreference.target !== memoryPreference.target) {
      if (candidatePreference.category && memoryPreference.category && candidatePreference.category === memoryPreference.category) {
        return true;
      }

      if (candidatePreference.root === memoryPreference.root) {
        return true;
      }
    }

    return false;
  }

  if (sameDomain && (candidate.type === MemoryType.PREFERENCE || memory.type === MemoryType.PREFERENCE)) {
    const similarity = calculateSimilarity(candidate.content, memory.content);
    if (similarity < 0.2 || similarity >= 0.9) {
      return false;
    }

    const candidatePreference = extractPreferenceDetails(candidate.content);
    const memoryPreference = extractPreferenceDetails(memory.content);

    if (!candidatePreference || !memoryPreference) {
      return false;
    }

    if (candidatePreference.target && memoryPreference.target && candidatePreference.target !== memoryPreference.target) {
      return true;
    }
  }

  return false;
}

function isSupersession(candidate: MemoryCandidate, memory: Memory, originalMessage?: string): boolean {
  const candidateLower = candidate.content.toLowerCase();
  const memoryLower = memory.content.toLowerCase();

  const replacementIndicators = [
    /moved\s+from/,
    /moved\s+to/,
    /no\s+longer/,
    /changed\s+from/,
    /changed\s+to/,
    /switched\s+from/,
    /switched\s+to/,
    /instead\s+of/,
    /used\s+to/,
    /formerly/,
    /previously/,
    /upgraded\s+to/,
    /now\s+use/,
    /now\s+using/,
    /currently\s+use/,
    /currently\s+using/,
    /\bnow$/,
    /\bcurrently$/,
    /^correction:\s*/i,
    /^actually[,\s]/i,
    /^update:\s*/i,
    /^i\s+meant\s+/i,
  ];

  const hasReplacementIndicator = replacementIndicators.some((regex) => regex.test(candidateLower));

  const originalHasIndicator = originalMessage
    ? replacementIndicators.some((regex) => regex.test(originalMessage.toLowerCase()))
    : false;

  if (!hasReplacementIndicator && !originalHasIndicator) {
    return false;
  }

  const sameType = candidate.type === memory.type;
  const candidateDomain = candidate.domain ?? extractDomain(candidate.content);
  const memoryDomain = extractDomain(memory.content);
  const sameDomain = candidateDomain && memoryDomain && candidateDomain === memoryDomain && candidateDomain !== "general";

  if (!sameType && !sameDomain) {
    return false;
  }

  const similarity = calculateSimilarity(candidateLower, memoryLower);
  if (sameType) {
    if (originalHasIndicator) {
      if (similarity < 0.15 || similarity >= 0.95) {
        return false;
      }
    } else {
      if (similarity < 0.35 || similarity >= 0.85) {
        return false;
      }
    }

    const candidateWords = new Set(tokenize(candidateLower));
    const memoryWords = new Set(tokenize(memoryLower));
    const sharedTokens = [...candidateWords].filter((token) => memoryWords.has(token));

    if (sharedTokens.length === 0) {
      return false;
    }
  } else if (sameDomain) {
    if (similarity < 0.15 || similarity >= 0.95) {
      return false;
    }
  }

  return true;
}

function hasReplacementIndicator(message: string): boolean {
  const replacementIndicators = [
    /moved\s+from/,
    /moved\s+to/,
    /no\s+longer/,
    /changed\s+from/,
    /changed\s+to/,
    /switched\s+from/,
    /switched\s+to/,
    /instead\s+of/,
    /used\s+to/,
    /formerly/,
    /previously/,
    /upgraded\s+to/,
    /now\s+use/,
    /now\s+using/,
    /currently\s+use/,
    /currently\s+using/,
    /\bnow$/,
    /\bcurrently$/,
  ];

  return replacementIndicators.some((regex) => regex.test(message.toLowerCase()));
}

function findSupersessionTargetByOriginalMessage(
  candidate: MemoryCandidate,
  memories: Memory[],
  originalMessage: string,
): Memory | undefined {
  const candidateWords = new Set(tokenize(candidate.content.toLowerCase()));
  const originalWords = new Set(tokenize(originalMessage.toLowerCase()));

  let bestMatch: Memory | undefined;
  let bestShared = 0;

  for (const memory of memories) {
    const memoryWords = new Set(tokenize(memory.content.toLowerCase()));
    const sharedWithCandidate = [...candidateWords].filter((token) => memoryWords.has(token)).length;
    const sharedWithOriginal = [...originalWords].filter((token) => memoryWords.has(token)).length;
    const totalShared = sharedWithCandidate + sharedWithOriginal;

    if (totalShared > bestShared) {
      bestShared = totalShared;
      bestMatch = memory;
    }
  }

  if (bestMatch && bestShared > 0) {
    return bestMatch;
  }

  return undefined;
}

function findPreferenceConflict(candidate: MemoryCandidate, memories: Memory[]): Memory | undefined {
  if (candidate.type !== MemoryType.PREFERENCE) {
    return undefined;
  }

  const candidatePreference = extractPreferenceDetails(candidate.content);
  if (!candidatePreference) {
    return undefined;
  }

  for (const memory of memories) {
    if (memory.type !== MemoryType.PREFERENCE) {
      continue;
    }

    const memoryPreference = extractPreferenceDetails(memory.content);
    if (!memoryPreference) {
      continue;
    }

    if (candidatePreference.target && memoryPreference.target && candidatePreference.target !== memoryPreference.target) {
      if (candidatePreference.category && memoryPreference.category && candidatePreference.category === memoryPreference.category) {
        return memory;
      }

      if (candidatePreference.root === memoryPreference.root) {
        return memory;
      }
    }
  }

  return undefined;
}

function findCrossTypeSupersessionTarget(candidate: MemoryCandidate, memories: Memory[]): Memory | undefined {
  const candidateDomain = candidate.domain ?? extractDomain(candidate.content);
  if (!candidateDomain || candidateDomain === "general") {
    return undefined;
  }

  const replacementIndicators = [
    /moved\s+from/,
    /moved\s+to/,
    /no\s+longer/,
    /changed\s+from/,
    /changed\s+to/,
    /switched\s+from/,
    /switched\s+to/,
    /instead\s+of/,
    /used\s+to/,
    /formerly/,
    /previously/,
    /upgraded\s+to/,
    /now\s+use/,
    /now\s+using/,
    /currently\s+use/,
    /currently\s+using/,
    /\bnow$/,
    /\bcurrently$/,
    /^correction:\s*/i,
    /^actually[,\s]/i,
    /^update:\s*/i,
    /^i\s+meant\s+/i,
  ];

  const hasReplacementIndicator = replacementIndicators.some((regex) => regex.test(candidate.content.toLowerCase()));

  if (!hasReplacementIndicator) {
    return undefined;
  }

  let bestMatch: Memory | undefined;
  let bestSimilarity = 0;

  for (const memory of memories) {
    if (memory.status === MemoryStatus.SUPERSEDED || memory.status === MemoryStatus.PENDING_CONFIRMATION) {
      continue;
    }

    const memoryDomain = extractDomain(memory.content);
    if (memoryDomain !== candidateDomain) {
      continue;
    }

    const similarity = calculateSimilarity(candidate.content, memory.content);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = memory;
    }
  }

  if (bestMatch && bestSimilarity >= 0.15) {
    return bestMatch;
  }

  return undefined;
}

function findCrossTypePreferenceConflict(candidate: MemoryCandidate, memories: Memory[]): Memory | undefined {
  const candidateDomain = candidate.domain ?? extractDomain(candidate.content);
  if (!candidateDomain || candidateDomain === "general") {
    return undefined;
  }

  const candidatePreference = extractPreferenceDetails(candidate.content);
  if (!candidatePreference) {
    return undefined;
  }

  for (const memory of memories) {
    if (memory.type !== MemoryType.PREFERENCE) {
      continue;
    }

    if (memory.status === MemoryStatus.SUPERSEDED || memory.status === MemoryStatus.PENDING_CONFIRMATION) {
      continue;
    }

    const memoryDomain = extractDomain(memory.content);
    if (memoryDomain !== candidateDomain) {
      continue;
    }

    const memoryPreference = extractPreferenceDetails(memory.content);
    if (!memoryPreference) {
      continue;
    }

    if (candidatePreference.target && memoryPreference.target && candidatePreference.target !== memoryPreference.target) {
      if (candidatePreference.category && memoryPreference.category && candidatePreference.category === memoryPreference.category) {
        return memory;
      }

      if (candidatePreference.root === memoryPreference.root) {
        return memory;
      }
    }
  }

  return undefined;
}

function extractPreferenceDetails(content: string) {
  const normalized = content.toLowerCase();

  const favoriteMatch = normalized.match(/user's\s+favorite\s+(\w+)\s+(?:is|are)\s+(.+)/);
  if (favoriteMatch) {
    return {
      root: "favorite",
      category: favoriteMatch[1].trim(),
      target: favoriteMatch[2].trim()
    };
  }

  const preferMatch = normalized.match(/user\s+prefers\s+(.+)/);
  if (preferMatch) {
    return {
      root: "prefers",
      target: preferMatch[1].trim()
    };
  }

  const likeMatch = normalized.match(/user\s+likes\s+(.+)/);
  if (likeMatch) {
    return {
      root: "likes",
      target: likeMatch[1].trim()
    };
  }

  const dislikeMatch = normalized.match(/user\s+dislikes\s+(.+)/);
  if (dislikeMatch) {
    return {
      root: "dislikes",
      target: dislikeMatch[1].trim()
    };
  }

  return null;
}

function normalizeContent(content: string): string {
  return normalizeRelationshipContent(content).trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(content: string): string[] {
  const cleaned = content
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token));

  return Array.from(new Set(cleaned));
}

function calculateSimilarity(contentA: string, contentB: string): number {
  const normalizedA = normalizeContent(contentA);
  const normalizedB = normalizeContent(contentB);

  if (normalizedA === normalizedB) {
    return 1;
  }

  const aTokens = tokenize(normalizedA);
  const bTokens = tokenize(normalizedB);
  if (aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }

  const sharedTokens = aTokens.filter((token) => bTokens.includes(token));
  const jaccard = sharedTokens.length / new Set([...aTokens, ...bTokens]).size;
  const containment = sharedTokens.length / Math.max(aTokens.length, bTokens.length);

  return Math.max(jaccard, containment);
}
