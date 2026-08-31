import {
  MemoryRepository,
  MemoryStatus,
  MemoryType,
  MemoryScope,
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

  async processMessage(message: string): Promise<PipelineResult> {

    const result: PipelineResult = {
      created: 0,
      updated: 0,
      ignored: 0,
      rejected: 0,
      superseded: 0,
      confirmed: 0,
      rejectedPending: 0,
      contradicted: 0,
      contradictionResolved: 0,
      createdMemories: [],
      updatedMemories: [],
      rejectedCandidates: [],
      pendingConfirmations: [],
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

      const existingMemories = await this.getActiveMemories(candidate.type);
      const review = reviewCandidate(candidate, existingMemories, message);

      // console.log("Review Decision:", review.decision, candidate.content);
      switch (review.decision) {
        case "CREATE": {
          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            scope: candidate.scope,
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
            scope: candidate.scope,
          });
          result.created += 1;
          result.createdMemories.push(created);
          result.pendingConfirmations.push(created);
          break;
        }
        case "SUPERSEDE": {
          if (!review.targetMemory) {
            result.ignored += 1;
            break;
          }

          const created = this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            scope: candidate.scope,
            supersedesId: review.targetMemory.id,
          });

          const superseded = this.repository.markSuperseded(review.targetMemory.id);

          result.created += 1;
          result.updated += 1;
          result.superseded += 1;
          result.createdMemories.push(created);
          result.updatedMemories.push(superseded ?? review.targetMemory);
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

  async processCandidates(
    candidates: MemoryCandidate[],
    originalMessage?: string,
  ): Promise<PipelineResult> {
    const result: PipelineResult = {
      created: 0,
      updated: 0,
      ignored: 0,
      rejected: 0,
      superseded: 0,
      confirmed: 0,
      rejectedPending: 0,
      contradicted: 0,
      contradictionResolved: 0,
      createdMemories: [],
      updatedMemories: [],
      rejectedCandidates: [],
      pendingConfirmations: [],
    };

    for (const candidate of this.normalizeCandidates(candidates)) {
      if (!this.isValidCandidate(candidate)) {
        result.rejected += 1;
        result.rejectedCandidates.push(candidate);
        continue;
      }

      const existingMemories = await this.getActiveMemories(candidate.type);

      const terminalExactMatch = await this.getExactMatchAnyStatus(candidate);

      if (terminalExactMatch) {
        result.ignored += 1;
        continue;
      }

      const review = reviewCandidate(candidate, existingMemories, originalMessage);

      switch (review.decision) {
        case "CREATE": {
          const created = await this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            scope: candidate.scope,
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

          const updated = await this.repository.updateMemory(review.targetMemory.id, {
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
          const created = await this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            status: MemoryStatus.PENDING_CONFIRMATION,
            scope: candidate.scope,
          });

          result.created += 1;
          result.createdMemories.push(created);
          result.pendingConfirmations.push(created);
          break;
        }

        case "SUPERSEDE": {
          if (!review.targetMemory) {
            result.ignored += 1;
            break;
          }

          const created = await this.repository.createMemory({
            type: candidate.type,
            content: candidate.content,
            importanceScore: candidate.importanceScore,
            confidenceScore: candidate.confidenceScore,
            sourceType: candidate.sourceType,
            scope: candidate.scope,
            supersedesId: review.targetMemory.id,
          });

          const superseded = await this.repository.markSuperseded(review.targetMemory.id);

          result.created += 1;
          result.updated += 1;
          result.superseded += 1;
          result.createdMemories.push(created);
          result.updatedMemories.push(superseded ?? review.targetMemory);
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

  async archiveMemoryCandidate(
    memoryId: string,
    reason: string,
  ): Promise<Memory | null> {
    const all = await this.repository.listMemories({});
    const target = all.find((memory) => memory.id === memoryId);

    if (!target || target.status !== MemoryStatus.ACTIVE) {
      return null;
    }

    return this.repository.archiveMemory(memoryId);
  }

  async confirmPendingMemory(
    memoryId: string,
    content?: string,
    confidenceScore?: number,
  ): Promise<Memory | null> {
    const confirmed = this.repository.confirmPendingMemory(memoryId, content, confidenceScore);

    if (!confirmed) {
      return null;
    }

    const result = await this.processCandidates([
      {
        type: confirmed.type,
        content: confirmed.content,
        confidenceScore: confirmed.confidenceScore,
        importanceScore: confirmed.importanceScore,
        sourceType: confirmed.sourceType,
        scope: confirmed.scope,
        reasoning: "Pending confirmation resolved by user",
      },
    ]);

    return result.createdMemories[0] ?? confirmed;
  }

  async rejectPendingMemory(memoryId: string): Promise<Memory | null> {
    return this.repository.rejectPendingMemory(memoryId);
  }

  async markMemoryContradicted(memoryId: string): Promise<Memory | null> {
    return this.repository.markContradicted(memoryId);
  }

  async resolveContradiction(
    memoryId: string,
    keepActive: boolean,
  ): Promise<Memory | null> {
    return this.repository.resolveContradiction(memoryId, keepActive);
  }

  private async getActiveMemories(type: MemoryType): Promise<Memory[]> {
    const all = await this.repository.listMemories({ type });
    const excluded = new Set([
      MemoryStatus.ARCHIVED,
      MemoryStatus.OBSOLETE,
      MemoryStatus.CONTRADICTED,
      MemoryStatus.PENDING_CONFIRMATION,
      MemoryStatus.SUPERSEDED,
    ]);
    return all.filter((memory) => !excluded.has(memory.status));
  }

  private async getExactMatchAnyStatus(candidate: MemoryCandidate): Promise<Memory | null> {
    const all = await this.repository.listMemories({ type: candidate.type });
    const normalizedContent = candidate.content.trim().toLowerCase();

    return all.find((memory) => {
      const memoryContent = memory.content.trim().toLowerCase();
      const isExactMatch = memoryContent === normalizedContent;
      const isTerminalStatus = [
        MemoryStatus.ARCHIVED,
        MemoryStatus.OBSOLETE,
        MemoryStatus.CONTRADICTED,
        MemoryStatus.PENDING_CONFIRMATION,
        MemoryStatus.SUPERSEDED,
      ].includes(memory.status);

      return isExactMatch && isTerminalStatus;
    }) ?? null;
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
