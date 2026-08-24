import type {
  ReflectionCandidate,
  ExperienceEvidence,
  ReflectionExperience,
} from "./reflection-candidate.js";
import { MemoryRepository, MemoryType, MemoryScope } from "../personal-memory.js";
import type { Memory } from "../personal-memory.js";

export interface ReflectionEngineOptions {
  minExperienceCount?: number;
  minConfidence?: number;
}

export class ReflectionEngine {
  private readonly minExperienceCount: number;
  private readonly minConfidence: number;

  constructor(
    private readonly memoryRepository: MemoryRepository,
    options: ReflectionEngineOptions = {},
  ) {
    this.minExperienceCount = options.minExperienceCount ?? 3;
    this.minConfidence = options.minConfidence ?? 0.8;
  }

  async reflect(experiences: ReflectionExperience[]): Promise<ReflectionCandidate[]> {
    const candidates: ReflectionCandidate[] = [];

    const grouped = this.groupExperiences(experiences);

    for (const [type, group] of Object.entries(grouped)) {
      const candidate = this.evaluatePattern(type, group);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private groupExperiences(experiences: ReflectionExperience[]): Record<string, ReflectionExperience[]> {
    const grouped: Record<string, ReflectionExperience[]> = {};

    for (const experience of experiences) {
      const key = experience.type;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(experience);
    }

    return grouped;
  }

  private evaluatePattern(
    type: string,
    experiences: ReflectionExperience[],
  ): ReflectionCandidate | null {
    const totalCount = experiences.reduce((sum, e) => sum + e.count, 0);

    if (totalCount < this.minExperienceCount) {
      return null;
    }

    const evidence: ExperienceEvidence[] = experiences.map((e) => ({
      experienceType: e.type,
      count: e.count,
      firstSeen: e.firstSeen,
      lastSeen: e.lastSeen,
      context: e.context,
    }));

    const preferenceType = this.mapExperienceToPreference(type);
    if (!preferenceType) {
      return null;
    }

    const existingMemory = this.findExistingMemory(preferenceType.memoryType, preferenceType.content);

    if (existingMemory) {
      return {
        proposalType: "UPDATE",
        memoryType: preferenceType.memoryType,
        content: preferenceType.content,
        confidence: this.calculateConfidence(totalCount),
        importance: existingMemory.importanceScore,
        reason: `Reinforced by ${totalCount} experiences of type ${type}`,
        evidence,
        affectedMemoryId: existingMemory.id,
        scope: existingMemory.scope,
      };
    }

    return {
      proposalType: "CREATE",
      memoryType: preferenceType.memoryType,
      content: preferenceType.content,
      confidence: this.calculateConfidence(totalCount),
      importance: 5,
      reason: `Observed ${totalCount} experiences of type ${type}`,
      evidence,
      scope: MemoryScope.USER,
    };
  }

  private mapExperienceToPreference(
    type: string,
  ): { memoryType: MemoryType; content: string } | null {
    if (type === "USER_SHARED_PREFERENCE") {
      return {
        memoryType: MemoryType.PREFERENCE,
        content: "User has shared preferences",
      };
    }

    if (type === "USER_SHARED_PROJECT") {
      return {
        memoryType: MemoryType.PROJECT,
        content: "User has shared project information",
      };
    }

    if (type === "USER_SHARED_RELATIONSHIP") {
      return {
        memoryType: MemoryType.RELATIONSHIP,
        content: "User has shared relationship information",
      };
    }

    if (type === "USER_EXPRESSED_FRUSTRATION") {
      return {
        memoryType: MemoryType.PREFERENCE,
        content: "User has expressed frustration",
      };
    }

    return null;
  }

  private findExistingMemory(type: MemoryType, content: string): Memory | null {
    const memories = this.memoryRepository.listMemories({});
    return memories.find((m) => m.type === type && m.content === content && m.status === "ACTIVE") ?? null;
  }

  private calculateConfidence(count: number): number {
    const base = Math.min(count / 10, 1);
    return Math.max(base, this.minConfidence);
  }
}
