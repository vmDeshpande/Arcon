/**
 * These are lightweight references.
 * The cognition package should not duplicate
 * models owned by other packages.
 */

export interface MemoryContext {
  memoryIds: string[];

  retrieved: number;
}

export interface EntityContext {
  entityIds: string[];

  retrieved: number;
}

export interface EmotionContext {
  currentMood?: string;

  emotions: Record<string, number>;
}

export interface ExperienceContext {
  experienceIds: string[];

  retrieved: number;
}

export interface ThoughtContext {
  memory: MemoryContext;

  entity: EntityContext;

  emotion: EmotionContext;

  experience: ExperienceContext;
}
