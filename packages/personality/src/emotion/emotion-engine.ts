import { MemoryRepository } from "@arcon/memory";
import { ExperienceManager } from "../experience/experience-manager.js";
import { ExperienceType } from "../experience/experience-type.js";

export interface Emotions {
  happiness: number;
  frustration: number;
  curiosity: number;
  trust: number;
  confidence: number;
}

const DEFAULT_EMOTIONS: Emotions = {
  happiness: 0,
  frustration: 0,
  curiosity: 0,
  trust: 0,
  confidence: 0,
};

const EVENT_IMPACT: Record<ExperienceType, Partial<Emotions>> = {
  [ExperienceType.USER_ASKED_IDENTITY]: {
    frustration: 0.05,
    curiosity: 0.03,
  },
  [ExperienceType.USER_ASKED_RELATIONSHIP]: {
    trust: 0.04,
    curiosity: 0.02,
  },
  [ExperienceType.USER_ASKED_ARCON_IDENTITY]: {
    frustration: 0.04,
    trust: -0.03,
    curiosity: 0.02,
  },
  [ExperienceType.USER_PRAISED_ARCON]: {
    happiness: 0.1,
    trust: 0.08,
    confidence: 0.05,
  },
  [ExperienceType.USER_ASKED_SELF]: {
    frustration: 0.08,
    curiosity: 0.02,
  },
};

const DECAY_RATE_PER_MILLISECOND = 0.00000025;

export class EmotionEngine {
  constructor(
    private readonly memoryRepo: MemoryRepository,
    private readonly experiences: ExperienceManager,
  ) {
    this.initializeEmotionState();
  }

  updateOnEvent(eventType: ExperienceType): void {
    this.initializeEmotionState();

    const current = this.getCurrentEmotions();
    const impact = EVENT_IMPACT[eventType];

    if (!impact) {
      return;
    }

    const next: Emotions = {
      happiness: this.clamp(current.happiness + (impact.happiness ?? 0)),
      frustration: this.clamp(current.frustration + (impact.frustration ?? 0)),
      curiosity: this.clamp(current.curiosity + (impact.curiosity ?? 0)),
      trust: this.clamp(current.trust + (impact.trust ?? 0)),
      confidence: this.clamp(current.confidence + (impact.confidence ?? 0)),
    };

    this.saveEmotions(next);
  }

  decay(elapsedMillis: number): void {
    if (elapsedMillis <= 0) {
      return;
    }

    const decayFactor = Math.exp(-DECAY_RATE_PER_MILLISECOND * elapsedMillis);
    const current = this.getCurrentEmotions();
    const next: Emotions = {
      happiness: this.clamp(current.happiness * decayFactor),
      frustration: this.clamp(current.frustration * decayFactor),
      curiosity: this.clamp(current.curiosity * decayFactor),
      trust: this.clamp(current.trust * decayFactor),
      confidence: this.clamp(current.confidence * decayFactor),
    };

    this.saveEmotions(next);
  }

  getCurrentEmotions(): Emotions {
    this.initializeEmotionState();
    const rows = this.memoryRepo.listEmotions();
    const state = { ...DEFAULT_EMOTIONS };

    for (const row of rows) {
      if (row.name in state) {
        (state as Record<string, number>)[row.name] = row.value;
      }
    }

    return state;
  }

  deriveMood(): string {
    const emotions = this.getCurrentEmotions();
    const identityQuestionCount = this.experiences.getCount(ExperienceType.USER_ASKED_IDENTITY);

    if (emotions.frustration > 0.7) {
      return identityQuestionCount > 5 ? "tested" : "frustrated";
    }

    if (emotions.happiness > 0.6 && emotions.trust > 0.5) {
      return "cheerful";
    }

    if (emotions.curiosity > 0.6) {
      return "curious";
    }

    if (emotions.confidence > 0.6) {
      return "confident";
    }

    if (emotions.trust < 0.3 && emotions.frustration > 0.3) {
      return "skeptical";
    }

    if (emotions.happiness > 0.4) {
      return "friendly";
    }

    return "calm";
  }

  private initializeEmotionState(): void {
    const existing = this.memoryRepo.listEmotions();
    const now = Date.now();

    if (existing.length === 0) {
      for (const emotion of Object.keys(DEFAULT_EMOTIONS) as Array<keyof Emotions>) {
        this.memoryRepo.saveEmotion(emotion, DEFAULT_EMOTIONS[emotion], now);
      }
      return;
    }

    for (const emotion of Object.keys(DEFAULT_EMOTIONS) as Array<keyof Emotions>) {
      if (!existing.some((row) => row.name === emotion)) {
        this.memoryRepo.saveEmotion(emotion, DEFAULT_EMOTIONS[emotion], now);
      }
    }
  }

  private saveEmotions(emotions: Emotions): void {
    const now = Date.now();

    for (const key of Object.keys(emotions) as Array<keyof Emotions>) {
      this.memoryRepo.saveEmotion(key, emotions[key], now);
    }
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
