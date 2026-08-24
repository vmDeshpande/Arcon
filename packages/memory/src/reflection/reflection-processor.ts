import { MemoryPipeline } from "../pipeline/memory-pipeline.js";
import type { MemoryRepository } from "../personal-memory.js";
import type { MemoryCandidate } from "../extractor/candidate.js";
import type { ReflectionCandidate, ReflectionResult } from "./reflection-candidate.js";
import { MemorySourceType } from "../personal-memory.js";

export class ReflectionProcessor {
  constructor(
    private readonly pipeline: MemoryPipeline,
    private readonly repository: MemoryRepository,
  ) {}

  async process(candidates: ReflectionCandidate[]): Promise<ReflectionResult> {
    const result = {
      candidates,
      processed: 0,
      proposed: 0,
      noOp: 0,
      rejected: 0,
    };

    for (const candidate of candidates) {
      result.processed += 1;

      if (candidate.proposalType === "NO_OP") {
        result.noOp += 1;
        continue;
      }

      if (!candidate.scope) {
        result.rejected += 1;
        continue;
      }

      const memoryCandidate: MemoryCandidate = {
        type: candidate.memoryType,
        content: candidate.content,
        confidenceScore: candidate.confidence,
        importanceScore: candidate.importance,
        sourceType: MemorySourceType.INFERRED,
        reasoning: candidate.reason,
        scope: candidate.scope,
      };

      switch (candidate.proposalType) {
        case "CREATE": {
          await this.pipeline.processCandidates([memoryCandidate]);
          result.proposed += 1;
          break;
        }

        case "UPDATE": {
          if (candidate.affectedMemoryId) {
            const existing = this.repository.getMemoryById(candidate.affectedMemoryId);
            if (existing && existing.status === "ACTIVE") {
              await this.pipeline.processCandidates([memoryCandidate]);
              result.proposed += 1;
            } else {
              result.rejected += 1;
            }
          } else {
            result.rejected += 1;
          }
          break;
        }

        case "SUPERSEDE": {
          if (candidate.affectedMemoryId) {
            const existing = this.repository.getMemoryById(candidate.affectedMemoryId);
            if (existing && existing.status === "ACTIVE") {
              await this.pipeline.processCandidates([memoryCandidate]);
              result.proposed += 1;
            } else {
              result.rejected += 1;
            }
          } else {
            result.rejected += 1;
          }
          break;
        }

        case "ARCHIVE": {
          if (candidate.affectedMemoryId) {
            const archived = await this.pipeline.archiveMemoryCandidate(
              candidate.affectedMemoryId,
              candidate.reason,
            );
            if (archived) {
              result.proposed += 1;
            } else {
              result.rejected += 1;
            }
          } else {
            result.rejected += 1;
          }
          break;
        }
      }
    }

    return result;
  }
}
