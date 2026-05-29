import type { MemoryCandidate, ExtractionResult, DuplicateCandidate } from "./candidate.js";
import { ExtractionRules, type ExtractionRuleConfig } from "./rules.js";

/**
 * MemoryExtractor analyzes user messages and generates MemoryCandidate objects.
 * 
 * This does NOT persist memories to the database.
 * It only produces structured candidates that can be validated and reviewed.
 */
export class MemoryExtractor {
  private rules: ExtractionRules;

  constructor(config?: Partial<ExtractionRuleConfig>) {
    this.rules = new ExtractionRules(config);
  }

  /**
   * Extract potential memory candidates from a user message
   */
  extract(message: string): ExtractionResult {
    const result: ExtractionResult = {
      candidates: [],
      duplicates: [],
      validationErrors: []
    };

    // Step 1: Validate the message
    const validation = this.rules.validateMessage(message);
    if (!validation.valid) {
      result.validationErrors = validation.errors;
      return result;
    }

    // Step 2: Extract candidates from all patterns
    // Order matters - check more specific patterns first to avoid false matches
    const rawCandidates: MemoryCandidate[] = [];

    // Check project patterns first (more specific: "I am building", "I am working on" etc)
    rawCandidates.push(...this.rules.extractProjects(message));
    // Then check constraints and goals (specific patterns)
    rawCandidates.push(...this.rules.extractConstraints(message));
    rawCandidates.push(...this.rules.extractGoals(message));
    // Then preferences and relationships
    rawCandidates.push(...this.rules.extractPreferences(message));
    rawCandidates.push(...this.rules.extractRelationships(message));
    // Finally facts (more general patterns)
    rawCandidates.push(...this.rules.extractFacts(message));

    // Step 3: Deduplicate candidates
    const { unique, duplicates } = this.deduplicateCandidates(rawCandidates);

    result.candidates = unique;
    result.duplicates = duplicates;

    return result;
  }

  /**
   * Deduplicate candidates based on content and type similarity
   * Removes near-duplicates that would represent the same memory
   */
  private deduplicateCandidates(
    candidates: MemoryCandidate[]
  ): { unique: MemoryCandidate[]; duplicates: DuplicateCandidate[] } {
    const unique: MemoryCandidate[] = [];
    const duplicates: DuplicateCandidate[] = [];

    for (const candidate of candidates) {
      const existingIndex = unique.findIndex(
        (existing) =>
          existing.type === candidate.type &&
          this.isSimilarContent(existing.content, candidate.content)
      );

      if (existingIndex >= 0) {
        // Keep the one with higher confidence
        if (candidate.confidenceScore > unique[existingIndex].confidenceScore) {
          const removed = unique[existingIndex];
          unique[existingIndex] = candidate;
          duplicates.push({
            candidate: removed,
            reason: `Superseded by higher confidence candidate (${removed.confidenceScore} -> ${candidate.confidenceScore})`
          });
        } else {
          duplicates.push({
            candidate,
            reason: `Duplicate of existing candidate with type ${candidate.type}`
          });
        }
      } else {
        unique.push(candidate);
      }
    }

    return { unique, duplicates };
  }

  /**
   * Check if two content strings are similar enough to be duplicates
   */
  private isSimilarContent(content1: string, content2: string): boolean {
    // Exact match
    if (content1.toLowerCase() === content2.toLowerCase()) {
      return true;
    }

    // Normalize for comparison (remove extra spaces, lowercase)
    const normalized1 = content1.toLowerCase().replace(/\s+/g, " ").trim();
    const normalized2 = content2.toLowerCase().replace(/\s+/g, " ").trim();

    // Check for exact normalized match
    if (normalized1 === normalized2) {
      return true;
    }

    // Check for substring containment (one is a subset of the other)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }

    // Calculate Levenshtein-like similarity for fuzzy matching
    const similarity = this.calculateSimilarity(normalized1, normalized2);
    // If strings are 80%+ similar, consider them duplicates
    return similarity >= 0.8;
  }

  /**
   * Calculate string similarity using a simple algorithm
   * Returns a score between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }

    return costs[s2.length];
  }
}
