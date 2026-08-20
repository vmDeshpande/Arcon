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

const EVENT_IMPACT: Partial<Record<ExperienceType, Partial<Emotions>>> = {
  [ExperienceType.USER_ASKED_IDENTITY]: {
    frustration: 0.04,
    curiosity: -0.02,
  },
  [ExperienceType.USER_ASKED_RELATIONSHIP]: {
    trust: 0.06,
    curiosity: 0.04,
  },
  [ExperienceType.USER_ASKED_ARCON_IDENTITY]: {
    trust: 0.05,
    curiosity: 0.08,
  },
  [ExperienceType.USER_PRAISED_ARCON]: {
    happiness: 0.15,
    trust: 0.1,
    confidence: 0.05,
  },
  [ExperienceType.USER_ASKED_SELF]: {
    trust: 0.05,
    curiosity: 0.08,
  },
  [ExperienceType.USER_TESTED_MEMORY]: {
    frustration: 0.05,
    curiosity: -0.03,
  },
  [ExperienceType.USER_CORRECTED_ARCON]: {
    confidence: 0.05,
    trust: 0.02,
  },
  [ExperienceType.USER_CORRECTED_MEMORY]: {
    confidence: 0.05,
    trust: 0.02,
  },
  [ExperienceType.USER_CONFIRMED_MEMORY]: {
    confidence: 0.06,
    trust: 0.06,
  },
  [ExperienceType.USER_SHARED_PREFERENCE]: {
    happiness: 0.05,
    trust: 0.05,
    curiosity: 0.03,
  },
  [ExperienceType.USER_SHARED_RELATIONSHIP]: {
    trust: 0.05,
    happiness: 0.02,
  },
  [ExperienceType.USER_SHARED_PROJECT]: {
    curiosity: 0.15,
    trust: 0.1,
    happiness: 0.05,
  },
  [ExperienceType.USER_ASKED_PROJECT]: {
    curiosity: 0.08,
    trust: 0.04,
  },
  [ExperienceType.USER_SHOWED_INTEREST]: {
    curiosity: 0.1,
    happiness: 0.03,
  },
  [ExperienceType.USER_EXPRESSED_FRUSTRATION]: {
    frustration: 0.08,
    confidence: -0.03,
  },
  [ExperienceType.USER_EXPRESSED_POSITIVE_FEEDBACK]: {
    happiness: 0.15,
    trust: 0.1,
    confidence: 0.05,
  },
  [ExperienceType.ARCON_ASKED_QUESTION]: {
    curiosity: 0.04,
    confidence: 0.02,
  },
  [ExperienceType.ARCON_HELPED_USER]: {
    happiness: 0.1,
    confidence: 0.08,
    trust: 0.05,
  },
  [ExperienceType.ARCON_DISCUSSED_INTEREST]: {
    happiness: 0.08,
    curiosity: 0.06,
  },
  [ExperienceType.ARCON_PROVIDED_ANSWER]: {
    confidence: 0.06,
    trust: 0.03,
  },
  [ExperienceType.ARCON_ACKNOWLEDGED_USER]: {
    trust: 0.04,
    happiness: 0.02,
  },
  [ExperienceType.ARCON_CELEBRATED_WITH_USER]: {
    happiness: 0.12,
    trust: 0.04,
  },
  [ExperienceType.ARCON_COMFORTED_USER]: {
    trust: 0.05,
    confidence: 0.03,
    happiness: 0.02,
  },
};

const DECAY_RATE_PER_MILLISECOND: Record<keyof Emotions, number> = {
  happiness: 0.00000008,
  frustration: 0.00000004,
  curiosity: 0.000000035,
  trust: 0.00000001,
  confidence: 0.00000001,
};

export class EmotionEngine {
  constructor(
    protected readonly memoryRepo: MemoryRepository,
    private readonly experiences: ExperienceManager,
  ) {
    this.initializeEmotionState();
  }

  updateOnEvent(eventType: ExperienceType, reason: string = eventType): void {
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
    this.debugEmotionUpdate(eventType, current, next, reason);
  }

  decay(elapsedMillis: number): void {
    if (elapsedMillis <= 0) {
      return;
    }

    const current = this.getCurrentEmotions();
    const next: Emotions = {
      happiness: this.decayEmotion(current.happiness, "happiness", elapsedMillis),
      frustration: this.decayEmotion(current.frustration, "frustration", elapsedMillis),
      curiosity: this.decayEmotion(current.curiosity, "curiosity", elapsedMillis),
      trust: this.decayEmotion(current.trust, "trust", elapsedMillis),
      confidence: this.decayEmotion(current.confidence, "confidence", elapsedMillis),
    };

    this.saveEmotions(next);
    this.debugEmotionUpdate("decay", current, next, `${elapsedMillis}ms elapsed`);
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

  protected saveEmotions(emotions: Emotions): void {
    const now = Date.now();

    for (const key of Object.keys(emotions) as Array<keyof Emotions>) {
      this.memoryRepo.saveEmotion(key, emotions[key], now);
    }
  }

  protected clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private decayEmotion(
    value: number,
    emotion: keyof Emotions,
    elapsedMillis: number,
  ): number {
    const decayFactor = Math.exp(-DECAY_RATE_PER_MILLISECOND[emotion] * elapsedMillis);
    return this.clamp(value * decayFactor);
  }

  private debugEmotionUpdate(
    event: ExperienceType | "decay",
    previous: Emotions,
    next: Emotions,
    reason: string,
  ): void {
    if (process.env.ARCON_EMOTION_DEBUG !== "1") {
      return;
    }

    console.log("[Arcon Emotion Update]", {
      event,
      previous,
      next,
      reason,
    });
  }
}
