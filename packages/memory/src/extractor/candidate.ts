import { MemoryType, MemorySourceType } from "../personal-memory.js";

/**
 * MemoryCandidate represents a potential memory extracted from user input.
 * This is NOT persisted to the database - it's a staging object for validation and review.
 */
export interface MemoryCandidate {
  /** The type of memory (FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT) */
  type: MemoryType;

  /** The structured content of the memory */
  content: string;

  /** Confidence score (0.0 - 1.0) in the correctness of this extraction */
  confidenceScore: number;

  /** Importance score (1 - 10) of how important this memory is */
  importanceScore: number;

  /** The source type of this memory */
  sourceType: MemorySourceType;

  /** Human-readable reasoning for why this candidate was extracted */
  reasoning: string;
}

/**
 * Represents a duplicate candidate that was filtered out
 */
export interface DuplicateCandidate {
  candidate: MemoryCandidate;
  reason: string;
}

/**
 * Result of extraction from a message
 */
export interface ExtractionResult {
  candidates: MemoryCandidate[];
  duplicates: DuplicateCandidate[];
  validationErrors: string[];
}
