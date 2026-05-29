import { MemoryType, MemorySourceType } from "../personal-memory.js";
import type { MemoryCandidate } from "./candidate.js";

/**
 * Configuration for extraction rules
 */
export interface ExtractionRuleConfig {
  minMessageLength: number;
  maxMessageLength: number;
}

export const DEFAULT_RULE_CONFIG: ExtractionRuleConfig = {
  minMessageLength: 10,
  maxMessageLength: 5000
};

/**
 * Pattern-based extraction rules for detecting memory types
 */
export class ExtractionRules {
  private config: ExtractionRuleConfig;

  constructor(config: Partial<ExtractionRuleConfig> = {}) {
    this.config = { ...DEFAULT_RULE_CONFIG, ...config };
  }

  /**
   * Extract PREFERENCE type memories
   * Patterns: "I like...", "I prefer...", "My favorite..."
   */
  extractPreferences(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Pattern: "My favorite X is Y"
    const favoriteMatch = message.match(
      /my\s+favorite\s+(\w+)\s+(?:is|are)\s+(.+?)(?:\.|$)/i
    );
    if (favoriteMatch) {
      candidates.push({
        type: MemoryType.PREFERENCE,
        content: `User's favorite ${favoriteMatch[1]} is ${favoriteMatch[2].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 6,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit favorite statement"
      });
    }

    // Pattern: "I prefer X"
    const preferMatch = message.match(/i\s+prefer\s+(.+?)(?:\.|$)/i);
    if (preferMatch && !favoriteMatch) {
      candidates.push({
        type: MemoryType.PREFERENCE,
        content: `User prefers ${preferMatch[1].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 6,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit preference statement"
      });
    }

    // Pattern: "I like X"
    const likeMatch = message.match(/i\s+(?:really\s+)?like\s+(.+?)(?:\.|$)/i);
    if (likeMatch && !favoriteMatch && !preferMatch) {
      candidates.push({
        type: MemoryType.PREFERENCE,
        content: `User likes ${likeMatch[1].trim()}`,
        confidenceScore: 0.85,
        importanceScore: 6,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Like statement indicating preference"
      });
    }

    // Pattern: "I don't like X" / "I dislike X"
    const dislikeMatch = message.match(
      /i\s+(?:don't\s+like|dislike)\s+(.+?)(?:\.|$)/i
    );
    if (dislikeMatch) {
      candidates.push({
        type: MemoryType.PREFERENCE,
        content: `User dislikes ${dislikeMatch[1].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 6,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit dislike statement"
      });
    }

    return candidates;
  }

  /**
   * Extract FACT type memories
   * Patterns: "I use...", "I am...", "I have...", "I work with..."
   */
  extractFacts(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Check if this message is about projects "I am/I'm building/working ON/creating/developing"
    // Note: "working on" is different from "work with"
    const isProject = message.match(
      /i(?:\s+am|\s*'m)?\s+(?:(?:currently\s+)?(?:building|working\s+on|creating|developing))/i
    );

    // Pattern: "I use X"
    const useMatch = message.match(/i\s+use\s+(.+?)(?:\.|$)/i);
    if (useMatch) {
      candidates.push({
        type: MemoryType.FACT,
        content: `User uses ${useMatch[1].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 5,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "User explicitly states they use something"
      });
    }

    // Pattern: "I work with X" - note: this is different from "working on"
    const workWithMatch = message.match(/i\s+work\s+with\s+(.+)$/i);
    if (workWithMatch) {
      candidates.push({
        type: MemoryType.FACT,
        content: `User works with ${workWithMatch[1].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 5,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "User explicitly states they work with something"
      });
    }

    // Pattern: "I am X" (profession, status) - but NOT if it's a project statement
    if (!isProject) {
      const amMatch = message.match(
        /i\s+am\s+(?:a\s+)?([^.,!?]*?)(?:\.|$)/i
      );
      if (amMatch && !useMatch) {
        const candidate = amMatch[1].trim().toLowerCase();
        // Filter out ambiguous or overly general statements
        if (
          !["here", "ready", "sorry", "confused", "not sure"].includes(candidate)
        ) {
          candidates.push({
            type: MemoryType.FACT,
            content: `User is ${candidate}`,
            confidenceScore: 0.85,
            importanceScore: 5,
            sourceType: MemorySourceType.USER_EXPLICIT,
            reasoning: "User states a fact about themselves"
          });
        }
      }
    }

    // Pattern: "I have X"
    const haveMatch = message.match(/i\s+have\s+(.+?)(?:\.|$)/i);
    if (haveMatch) {
      candidates.push({
        type: MemoryType.FACT,
        content: `User has ${haveMatch[1].trim()}`,
        confidenceScore: 0.85,
        importanceScore: 5,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "User explicitly states they have something"
      });
    }

    return candidates;
  }

  /**
   * Extract PROJECT type memories
   * Patterns: "I am building...", "I'm working on...", "I am creating..."
   */
  extractProjects(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Pattern: "I am building X" / "I'm building X"
    const buildMatch = message.match(
      /i(?:\s+am|\s*'m)?\s+(?:currently\s+)?building\s+(.+?)(?:\.|$)/i
    );
    if (buildMatch) {
      candidates.push({
        type: MemoryType.PROJECT,
        content: `User is building ${buildMatch[1].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about current project"
      });
    }

    // Pattern: "I am working on X" / "I'm working on X"
    const workingMatch = message.match(
      /i(?:\s+am|\s*'m)?\s+(?:currently\s+)?working\s+on\s+(.+?)(?:\.|$)/i
    );
    if (workingMatch && !buildMatch) {
      candidates.push({
        type: MemoryType.PROJECT,
        content: `User is working on ${workingMatch[1].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about current work"
      });
    }

    // Pattern: "I am creating X"
    const creatingMatch = message.match(
      /i(?:\s+am|\s*'m)?\s+(?:currently\s+)?creating\s+(.+?)(?:\.|$)/i
    );
    if (creatingMatch && !buildMatch && !workingMatch) {
      candidates.push({
        type: MemoryType.PROJECT,
        content: `User is creating ${creatingMatch[1].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about project creation"
      });
    }

    // Pattern: "I am developing X"
    const developingMatch = message.match(
      /i(?:\s+am|\s*'m)?\s+(?:currently\s+)?developing\s+(.+?)(?:\.|$)/i
    );
    if (developingMatch && !buildMatch && !workingMatch && !creatingMatch) {
      candidates.push({
        type: MemoryType.PROJECT,
        content: `User is developing ${developingMatch[1].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about project development"
      });
    }

    return candidates;
  }

  /**
   * Extract GOAL type memories
   * Patterns: "My goal is...", "I want to...", "I aim to..."
   */
  extractGoals(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Pattern: "My goal is X"
    const goalMatch = message.match(/my\s+goal\s+(?:is|to)\s+(.+?)(?:\.|$)/i);
    if (goalMatch) {
      candidates.push({
        type: MemoryType.GOAL,
        content: `User's goal is to ${goalMatch[1].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit goal statement"
      });
    }

    // Pattern: "I want to X"
    const wantMatch = message.match(
      /i\s+want\s+(?:to|for)\s+(.+?)(?:\.|$)/i
    );
    if (wantMatch && !goalMatch) {
      candidates.push({
        type: MemoryType.GOAL,
        content: `User wants to ${wantMatch[1].trim()}`,
        confidenceScore: 0.8,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Want statement indicating a goal"
      });
    }

    // Pattern: "I aim to X"
    const aimMatch = message.match(/i\s+aim\s+(?:to|for)\s+(.+?)(?:\.|$)/i);
    if (aimMatch && !goalMatch && !wantMatch) {
      candidates.push({
        type: MemoryType.GOAL,
        content: `User aims to ${aimMatch[1].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Aim statement indicating a goal"
      });
    }

    // Pattern: "I need to X" / "I should X"
    const needMatch = message.match(
      /i\s+(?:need|should)\s+(?:to\s+)?(.+?)(?:\.|$)/i
    );
    if (needMatch && !goalMatch && !wantMatch && !aimMatch) {
      candidates.push({
        type: MemoryType.GOAL,
        content: `User needs to ${needMatch[1].trim()}`,
        confidenceScore: 0.75,
        importanceScore: 8,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Need/should statement indicating a goal"
      });
    }

    return candidates;
  }

  /**
   * Extract CONSTRAINT type memories
   * Patterns: "X must...", "X can't...", "X should only..."
   */
  extractConstraints(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Pattern: "X must Y"
    const mustMatch = message.match(/(\w+[\w\s]*?)\s+must\s+(.+?)(?:\.|$)/i);
    if (mustMatch) {
      candidates.push({
        type: MemoryType.CONSTRAINT,
        content: `${mustMatch[1].trim()} must ${mustMatch[2].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit constraint with must"
      });
    }

    // Pattern: "X can't Y" / "X cannot Y"
    const cantMatch = message.match(
      /(\w+[\w\s]*?)\s+(?:can't|cannot)\s+(.+?)(?:\.|$)/i
    );
    if (cantMatch && !mustMatch) {
      candidates.push({
        type: MemoryType.CONSTRAINT,
        content: `${cantMatch[1].trim()} cannot ${cantMatch[2].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit constraint with cannot"
      });
    }

    // Pattern: "X should only Y"
    const shouldOnlyMatch = message.match(
      /(\w+[\w\s]*?)\s+should\s+only\s+(.+?)(?:\.|$)/i
    );
    if (shouldOnlyMatch) {
      candidates.push({
        type: MemoryType.CONSTRAINT,
        content: `${shouldOnlyMatch[1].trim()} should only ${shouldOnlyMatch[2].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 9,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit constraint with should only"
      });
    }

    return candidates;
  }

  /**
   * Extract RELATIONSHIP type memories
   * Patterns: "X works with...", "X and I...", "X wants to..."
   */
  extractRelationships(message: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    // Pattern: "X works with me" or "X works with arcon"
    const worksWithMatch = message.match(
      /(\w+[\w\s]*?)\s+(?:works|is\s+working)\s+with\s+(me|arcon|my\s+\w+)/i
    );
    if (worksWithMatch) {
      candidates.push({
        type: MemoryType.RELATIONSHIP,
        content: `${worksWithMatch[1].trim()} works with ${worksWithMatch[2].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 7,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about working relationship"
      });
    }

    // Pattern: "X wants to contribute to"
    const contributeMatch = message.match(
      /(\w+[\w\s]*?)\s+wants?\s+to\s+contribute\s+to\s+(.+?)(?:\.|$)/i
    );
    if (contributeMatch) {
      candidates.push({
        type: MemoryType.RELATIONSHIP,
        content: `${contributeMatch[1].trim()} wants to contribute to ${contributeMatch[2].trim()}`,
        confidenceScore: 0.9,
        importanceScore: 7,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit statement about collaborative relationship"
      });
    }

    // Pattern: "X and I" with collaboration implied
    const andIMatch = message.match(
      /(\w+[\w\s]*?)\s+and\s+i\s+(?:are|are\s+both|both)\s+(.+?)(?:\.|$)/i
    );
    if (andIMatch) {
      candidates.push({
        type: MemoryType.RELATIONSHIP,
        content: `User and ${andIMatch[1].trim()} are both ${andIMatch[2].trim()}`,
        confidenceScore: 0.8,
        importanceScore: 7,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Relationship identified through joint action"
      });
    }

    // Pattern: "X is my [role]"
    const myRoleMatch = message.match(
      /(\w+[\w\s]*?)\s+is\s+my\s+(\w+)(?:\.|$)/i
    );
    if (myRoleMatch) {
      candidates.push({
        type: MemoryType.RELATIONSHIP,
        content: `${myRoleMatch[1].trim()} is user's ${myRoleMatch[2].trim()}`,
        confidenceScore: 0.95,
        importanceScore: 7,
        sourceType: MemorySourceType.USER_EXPLICIT,
        reasoning: "Explicit relationship role statement"
      });
    }

    return candidates;
  }

  /**
   * Validate message for extraction readiness
   */
  validateMessage(message: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message || typeof message !== "string") {
      errors.push("Message must be a non-empty string");
    }

    if (message.trim().length === 0) {
      errors.push("Message is empty");
    }

    if (message.trim().length < this.config.minMessageLength) {
      errors.push(
        `Message too short (${message.trim().length} < ${this.config.minMessageLength})`
      );
    }

    if (message.length > this.config.maxMessageLength) {
      errors.push(
        `Message too long (${message.length} > ${this.config.maxMessageLength})`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
