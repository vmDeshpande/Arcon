import type { ReflectionExperience } from "./reflection-candidate.js";
import type { ReflectionCandidate, ReflectionResult } from "./reflection-candidate.js";
import { ReflectionProcessor } from "./reflection-processor.js";
import { ReflectionEngine } from "./reflection-engine.js";

export interface ReflectionTriggerOptions {
  threshold?: number;
}

export class ReflectionTrigger {
  private pendingExperiences: ReflectionExperience[] = [];
  private readonly threshold: number;

  constructor(
    private readonly processor: ReflectionProcessor,
    private readonly engine: ReflectionEngine,
    options: ReflectionTriggerOptions = {},
  ) {
    this.threshold = options.threshold ?? 5;
  }

  addExperience(experience: ReflectionExperience): boolean {
    this.pendingExperiences.push(experience);
    return this.pendingExperiences.length >= this.threshold;
  }

  async flush(): Promise<ReflectionResult> {
    if (this.pendingExperiences.length === 0) {
      return {
        candidates: [],
        processed: 0,
        proposed: 0,
        noOp: 0,
        rejected: 0,
      };
    }

    const candidates = await this.engine.reflect(this.pendingExperiences);
    const result = await this.processor.process(candidates);

    this.pendingExperiences = [];

    return result;
  }

  get pendingCount(): number {
    return this.pendingExperiences.length;
  }
}
