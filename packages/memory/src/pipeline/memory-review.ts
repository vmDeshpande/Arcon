import { MemoryType } from "../personal-memory.js";
import type { Memory } from "../personal-memory.js";
import type { MemoryCandidate } from "../extractor/candidate.js";

export type MemoryReviewDecision = "CREATE" | "UPDATE" | "IGNORE" | "CONFLICT";

export interface MemoryReview {
  decision: MemoryReviewDecision;
  targetMemory?: Memory;
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
  "did"
]);

const PREFERENCE_ROOT_WORDS = new Set(["prefer", "prefers", "like", "likes", "dislike", "dislikes", "favorite"]);

export function reviewCandidate(candidate: MemoryCandidate, existingMemories: Memory[]): MemoryReview {
  const relevant = existingMemories.filter((memory) => memory.type === candidate.type);

  const exactMatch = relevant.find((memory) => normalizeContent(memory.content) === normalizeContent(candidate.content));
  if (exactMatch) {
    return {
      decision: "IGNORE",
      targetMemory: exactMatch
    };
  }

  const bestMatch = findBestMatch(candidate, relevant);
  if (!bestMatch) {
    return { decision: "CREATE" };
  }

  if (isConflict(candidate, bestMatch.memory)) {
    return {
      decision: "CONFLICT",
      targetMemory: bestMatch.memory
    };
  }

  if (bestMatch.similarity >= 0.75) {
    return {
      decision: "UPDATE",
      targetMemory: bestMatch.memory
    };
  }

  return { decision: "CREATE" };
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
  if (candidate.type !== MemoryType.PREFERENCE || memory.type !== MemoryType.PREFERENCE) {
    return false;
  }

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
  return content.trim().toLowerCase().replace(/\s+/g, " ");
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
