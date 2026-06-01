import {
  MemoryRepository,
  MemoryStatus,
  MemoryType,
  type Memory,
} from "../personal-memory.js";
import { MemoryExtractor } from "../extractor/memory-extractor.js";
import type { MemoryCandidate } from "../extractor/candidate.js";
import type { PipelineResult } from "./memory-result.js";
import { reviewCandidate } from "./memory-review.js";
import type { ExtractionRuleConfig } from "../extractor/rules.js";
import {
  isBlockedUserIdentityName,
  normalizeRelationshipContent,
} from "../entity/entity-relationship-extractor.js";
import { isRedundantEntityOnlyMemory } from "../semantic/memory-quality.js";

const DEFAULT_MIN_CONFIDENCE = 0.7;

export interface MemoryPipelineOptions {
  minConfidenceScore?: number;
  extractorConfig?: Partial<ExtractionRuleConfig>;
}

export class MemoryPipeline {
  private readonly repository: MemoryRepository;
  private readonly extractor: MemoryExtractor;
  private readonly minConfidenceScore: number;

  constructor(
    repository: MemoryRepository,
    options: MemoryPipelineOptions = {},
  ) {
    this.repository = repository;
    this.extractor = new MemoryExtractor(options.extractorConfig);
    this.minConfidenceScore =
      options.minConfidenceScore ?? DEFAULT_MIN_CONFIDENCE;
  }

  processMessage(message: string): PipelineResult {
    const result: PipelineResult = {
      created: 0,
      updated: 0,
      ignored: 0,
      rejected: 0,
      createdMemories: [],
      updatedMemories: [],
      rejectedCandidates: [],
    };

    let extraction = this.extractor.extract(message);
    if (extraction.validationErrors.length > 0) {
      result.rejected = extraction.validationErrors.length;
      return result;
    }

    for (const candidate of this.normalizeCandidates(extraction.candidates)) {
      if (!this.isValidCandidate(candidate)) {
        result.rejected += 1;
        result.rejectedCandidates.push(candidate);
        continue;
      }

      const existingMemories = this.repository.listMemories({
        type: candidate.type,
      });
      const review = reviewCandidate(candidate, existingMemories);
      // console.log("Review Decision:", review.decision, candidate.content);

      switch (review.decision) {
        case "CREATE": {
          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
          });
          result.created += 1;
          result.createdMemories.push(created);
          // console.log("CREATING MEMORY:", candidate);
          break;
        }
        case "UPDATE": {
          if (!review.targetMemory) {
            result.ignored += 1;
            break;
          }

          const updated = this.repository.updateMemory(review.targetMemory.id, {
            content:
              candidate.content !== review.targetMemory.content
                ? candidate.content
                : review.targetMemory.content,
            confidenceScore: Math.max(
              review.targetMemory.confidenceScore,
              candidate.confidenceScore,
            ),
            importanceScore: Math.max(
              review.targetMemory.importanceScore,
              candidate.importanceScore,
            ),
            sourceType: candidate.sourceType,
            evidenceCount: review.targetMemory.evidenceCount + 1,
          });

          if (updated) {
            result.updated += 1;
            result.updatedMemories.push(updated);
          } else {
            result.ignored += 1;
          }
          break;
        }
        case "CONFLICT": {
          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            status: MemoryStatus.PENDING_CONFIRMATION,
          });
          result.created += 1;
          result.createdMemories.push(created);
          break;
        }
        case "IGNORE": {
          result.ignored += 1;
          break;
        }
      }
    }

    return result;
  }

  processCandidates(
    candidates: MemoryCandidate[],
  ): PipelineResult {
    const result: PipelineResult = {
      created: 0,
      updated: 0,
      ignored: 0,
      rejected: 0,
      createdMemories: [],
      updatedMemories: [],
      rejectedCandidates: [],
    };

    for (const candidate of this.normalizeCandidates(candidates)) {
      if (!this.isValidCandidate(candidate)) {
        result.rejected += 1;
        result.rejectedCandidates.push(candidate);
        continue;
      }

      const existingMemories = this.repository.listMemories({
        type: candidate.type,
      });

      const review = reviewCandidate(candidate, existingMemories);

      // console.log("Review Decision:", review.decision, candidate.content);

      switch (review.decision) {
        case "CREATE": {
          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
          });

          result.created += 1;
          result.createdMemories.push(created);
          break;
        }

        case "UPDATE": {
          if (!review.targetMemory) {
            result.ignored += 1;
            break;
          }

          const updated = this.repository.updateMemory(review.targetMemory.id, {
            content: candidate.content,
            confidenceScore: Math.max(
              review.targetMemory.confidenceScore,
              candidate.confidenceScore,
            ),
            importanceScore: Math.max(
              review.targetMemory.importanceScore,
              candidate.importanceScore,
            ),
            sourceType: candidate.sourceType,
            evidenceCount: review.targetMemory.evidenceCount + 1,
          });

          if (updated) {
            result.updated += 1;
            result.updatedMemories.push(updated);
          }

          break;
        }

        case "CONFLICT": {
          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            status: MemoryStatus.PENDING_CONFIRMATION,
          });

          result.created += 1;
          result.createdMemories.push(created);
          break;
        }

        case "IGNORE": {
          result.ignored += 1;
          break;
        }
      }
    }

    return result;
  }

  private isValidCandidate(candidate: MemoryCandidate): boolean {
    if (!candidate.content || candidate.content.trim().length === 0) {
      return false;
    }

    if (candidate.confidenceScore < this.minConfidenceScore) {
      return false;
    }

    if (
      !Number.isFinite(candidate.confidenceScore) ||
      candidate.confidenceScore < 0 ||
      candidate.confidenceScore > 1
    ) {
      return false;
    }

    if (
      !Number.isInteger(candidate.importanceScore) ||
      candidate.importanceScore < 1 ||
      candidate.importanceScore > 10
    ) {
      return false;
    }

    return true;
  }

  private normalizeCandidates(
    candidates: MemoryCandidate[],
  ): MemoryCandidate[] {
    const normalizedCandidates = candidates.flatMap((candidate) => {
      const normalized = this.normalizeCandidate(candidate);
      return normalized ? [normalized] : [];
    });
    const seen = new Set<string>();
    const unique: MemoryCandidate[] = [];

    for (const candidate of normalizedCandidates) {
      const key = `${candidate.type}:${candidate.content.toLowerCase()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(candidate);
    }

    return unique;
  }

  private normalizeCandidate(candidate: MemoryCandidate): MemoryCandidate | null {
    const trimmedContent = candidate.content.trim();

    if (isRedundantEntityOnlyMemory(trimmedContent)) {
      return null;
    }

    if (candidate.type !== MemoryType.RELATIONSHIP) {
      return {
        ...candidate,
        content: trimmedContent,
      };
    }

    const content = normalizeRelationshipContent(trimmedContent);
    const selfMatch = content.match(/^User's self is ([a-z][a-zA-Z]*)$/i);

    if (selfMatch && isBlockedUserIdentityName(selfMatch[1])) {
      return null;
    }

    return {
      ...candidate,
      content,
    };
  }

}
