import { MemoryRepository } from "@arcon/memory";
import { ExperienceManager } from "../experience/experience-manager.js";
import { ExperienceType } from "../experience/experience-type.js";

export interface Emotions {
  happiness: number;
  frustration: number;
  curiosity: number;
  trust: number;
  confidence: number;
  excitement: number;
}

export interface EmotionSnapshot {
  emotions: Emotions;
  deltas: Partial<Emotions>;
  reason: string;
  updatedAt: number;
}

export const EMOTION_BASELINES: Record<keyof Emotions, number> = {
  happiness: 0.5,
  frustration: 0.1,
  curiosity: 0.5,
  trust: 0.5,
  confidence: 0.5,
  excitement: 0.4,
};

export const DECAY_HALF_LIFE_MS: Record<keyof Emotions, number> = {
  happiness: 30 * 60 * 1000,
  frustration: 20 * 60 * 1000,
  curiosity: 45 * 60 * 1000,
  trust: 60 * 60 * 1000,
  confidence: 40 * 60 * 1000,
  excitement: 15 * 60 * 1000,
};

export function getEventImpact(eventType: ExperienceType): Partial<Emotions> {
  return EVENT_IMPACT[eventType] ?? {};
}

const SATURATION_THRESHOLD = 0.7;
const SATURATION_MIN_EFFECTIVENESS = 0.25;

export interface EmotionTransition {
  event: ExperienceType | "user_emotion" | "arcon_emotion" | "decay";
  deltas: Partial<Emotions>;
  reason: string;
  context?: Record<string, unknown>;
}

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
    trust: 0.05,
    confidence: 0.02,
  },
  [ExperienceType.USER_EXPRESSED_POSITIVE_FEEDBACK]: {
    happiness: 0.15,
    trust: 0.1,
    confidence: 0.05,
  },
  [ExperienceType.USER_EMOTIONAL_EXCITED]: {
    happiness: 0.08,
    trust: 0.03,
    curiosity: 0.04,
    excitement: 0.06,
  },
  [ExperienceType.USER_EMOTIONAL_FRUSTRATED]: {
    trust: 0.05,
    confidence: 0.02,
  },
  [ExperienceType.USER_EMOTIONAL_CONFUSED]: {
    confidence: 0.03,
    curiosity: 0.02,
  },
  [ExperienceType.USER_SHARED_SUCCESS]: {
    happiness: 0.12,
    trust: 0.06,
    excitement: 0.10,
    confidence: 0.04,
  },
  [ExperienceType.USER_SHARED_FAILURE]: {
    trust: 0.04,
    confidence: 0.02,
  },
  [ExperienceType.USER_ASKED_OPINION]: {
    trust: 0.04,
    curiosity: 0.03,
  },
  [ExperienceType.USER_SHOWED_TRUST]: {
    trust: 0.08,
    happiness: 0.03,
  },
  [ExperienceType.USER_REJECTED_SUGGESTION]: {
    confidence: -0.02,
    trust: -0.01,
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
    excitement: 0.05,
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
  [ExperienceType.ARCON_EXPLORED_TOPIC]: {
    curiosity: 0.06,
    confidence: 0.02,
  },
  [ExperienceType.ARCON_DISCOVERED_INTEREST]: {
    curiosity: 0.08,
    excitement: 0.04,
    happiness: 0.03,
  },
  [ExperienceType.ARCON_RECEIVED_POSITIVE_FEEDBACK]: {
    happiness: 0.10,
    confidence: 0.06,
    trust: 0.04,
  },
  [ExperienceType.ARCON_RECEIVED_NEGATIVE_FEEDBACK]: {
    confidence: -0.03,
    frustration: 0.02,
  },
};

export class EmotionEngine {
  protected lastUpdateTimestamp: number;

  constructor(
    protected readonly memoryRepo: MemoryRepository,
    protected readonly experiences: ExperienceManager,
  ) {
    this.lastUpdateTimestamp = Date.now();
    this.initializeEmotionState();
  }

  protected getExperiences(): ExperienceManager {
    return this.experiences;
  }

  getCurrentEmotions(): Emotions {
    this.initializeEmotionState();
    const rows = this.memoryRepo.listEmotions();
    const state: Emotions = {
      happiness: EMOTION_BASELINES.happiness,
      frustration: EMOTION_BASELINES.frustration,
      curiosity: EMOTION_BASELINES.curiosity,
      trust: EMOTION_BASELINES.trust,
      confidence: EMOTION_BASELINES.confidence,
      excitement: EMOTION_BASELINES.excitement,
    };

    for (const row of rows) {
      if (row.name === "_emotion_schema_version") {
        continue;
      }
      if (row.name in state) {
        (state as unknown as Record<string, number>)[row.name] = (row as { value: number }).value;
      }
    }

    return state;
  }

  applyTransition(transition: EmotionTransition): EmotionSnapshot {
    const previous = this.getCurrentEmotions();
    const now = Date.now();
    const elapsed = now - this.lastUpdateTimestamp;

    if (elapsed > 0) {
      this.decay(elapsed);
    }

    const current = this.getCurrentEmotions();
    const saturatedDeltas = this.applySaturation(transition.deltas, current);
    const next = this.buildNextState(current, saturatedDeltas);

    this.saveEmotions(next);
    this.lastUpdateTimestamp = now;

    const deltas: Partial<Emotions> = {};
    for (const key of Object.keys(previous) as Array<keyof Emotions>) {
      deltas[key] = this.roundDelta(next[key] - previous[key]);
    }

    this.debugTransition(transition, previous, next, deltas);

    return {
      emotions: next,
      deltas,
      reason: transition.reason,
      updatedAt: now,
    };
  }

  increaseCuriosity(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { curiosity: amount },
      reason: "Explicit curiosity increase",
    });
  }

  increaseTrust(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { trust: amount },
      reason: "Explicit trust increase",
    });
  }

  increaseExcitement(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { excitement: amount },
      reason: "Explicit excitement increase",
    });
  }

  recordUserTurn(message: string): EmotionSnapshot {
    return {
      emotions: this.getCurrentEmotions(),
      deltas: {},
      reason: "User turn processed by EmotionEngine",
      updatedAt: Date.now(),
    };
  }

  getEmotionSnapshot(): EmotionSnapshot {
    return {
      emotions: this.getCurrentEmotions(),
      deltas: {},
      reason: "Snapshot",
      updatedAt: Date.now(),
    };
  }

  reset(): void {
    this.saveEmotions({
      happiness: EMOTION_BASELINES.happiness,
      frustration: EMOTION_BASELINES.frustration,
      curiosity: EMOTION_BASELINES.curiosity,
      trust: EMOTION_BASELINES.trust,
      confidence: EMOTION_BASELINES.confidence,
      excitement: EMOTION_BASELINES.excitement,
    });
    this.lastUpdateTimestamp = Date.now();
  }

  decay(elapsedMillis: number): void {
    if (elapsedMillis <= 0) {
      return;
    }

    const current = this.getCurrentEmotions();
    const next: Emotions = {
      happiness: this.decayTowardBaseline(current.happiness, "happiness", elapsedMillis),
      frustration: this.decayTowardBaseline(current.frustration, "frustration", elapsedMillis),
      curiosity: this.decayTowardBaseline(current.curiosity, "curiosity", elapsedMillis),
      trust: this.decayTowardBaseline(current.trust, "trust", elapsedMillis),
      confidence: this.decayTowardBaseline(current.confidence, "confidence", elapsedMillis),
      excitement: this.decayTowardBaseline(current.excitement, "excitement", elapsedMillis),
    };

    this.saveEmotions(next);
    this.lastUpdateTimestamp = Date.now();
  }

  deriveMood(): string {
    const emotions = this.getCurrentEmotions();
    const identityQuestionCount = this.experiences.getCount(ExperienceType.USER_ASKED_IDENTITY);

    if (emotions.frustration > 0.6) {
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

  updateOnEvent(eventType: ExperienceType, reason: string = eventType): EmotionSnapshot {
    const impact = getEventImpact(eventType);

    if (Object.keys(impact).length === 0) {
      return {
        emotions: this.getCurrentEmotions(),
        deltas: {},
        reason,
        updatedAt: Date.now(),
      };
    }

    return this.applyTransition({
      event: eventType,
      deltas: impact,
      reason,
    });
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

  private initializeEmotionState(): void {
    const existing = this.memoryRepo.listEmotions();
    const now = Date.now();
    const versionMarker = "_emotion_schema_version";
    const hasVersionMarker = existing.some((row) => row.name === versionMarker);

    if (!hasVersionMarker) {
      const emotionRows = existing.filter((row) => row.name !== versionMarker);
      const isLegacyAllZeros = emotionRows.length > 0 &&
        emotionRows.every((row) => (row as { value: number }).value === 0);

      if (existing.length === 0 || isLegacyAllZeros) {
        for (const emotion of Object.keys(EMOTION_BASELINES) as Array<keyof Emotions>) {
          this.memoryRepo.saveEmotion(emotion, EMOTION_BASELINES[emotion], now);
        }
        this.memoryRepo.saveEmotion(versionMarker, 1, now);
        return;
      }
    }

    if (!hasVersionMarker) {
      this.memoryRepo.saveEmotion(versionMarker, 1, now);
    }

    for (const emotion of Object.keys(EMOTION_BASELINES) as Array<keyof Emotions>) {
      if (!existing.some((row) => row.name === emotion)) {
        this.memoryRepo.saveEmotion(emotion, EMOTION_BASELINES[emotion], now);
      }
    }
  }

  private decayTowardBaseline(value: number, emotion: keyof Emotions, elapsedMillis: number): number {
    const baseline = EMOTION_BASELINES[emotion];
    const halfLife = DECAY_HALF_LIFE_MS[emotion];

    if (elapsedMillis <= 0 || value === baseline) {
      return value;
    }

    const factor = Math.pow(0.5, elapsedMillis / halfLife);
    return baseline + (value - baseline) * factor;
  }

  private applySaturation(deltas: Partial<Emotions>, current: Emotions): Partial<Emotions> {
    const result: Partial<Emotions> = {};

    for (const key of Object.keys(deltas) as Array<keyof Emotions>) {
      const delta = deltas[key];
      if (delta === undefined || delta === 0) {
        continue;
      }

      const value = current[key];
      const absDelta = Math.abs(delta);

      if (absDelta > 0) {
        const effectiveness = this.getSaturationEffectiveness(delta, value);
        result[key] = delta * effectiveness;
      }
    }

    return result;
  }

  private getSaturationEffectiveness(delta: number, current: number): number {
    if (delta > 0 && current >= 1) return 0;
    if (delta < 0 && current <= 0) return 0;

    if (delta > 0 && current > SATURATION_THRESHOLD) {
      const distance = current - SATURATION_THRESHOLD;
      const range = 1 - SATURATION_THRESHOLD;
      return SATURATION_MIN_EFFECTIVENESS + (1 - SATURATION_MIN_EFFECTIVENESS) * Math.max(0, 1 - distance / range);
    }

    if (delta < 0 && current < (1 - SATURATION_THRESHOLD)) {
      const distance = (1 - SATURATION_THRESHOLD) - current;
      const range = 1 - SATURATION_THRESHOLD;
      return SATURATION_MIN_EFFECTIVENESS + (1 - SATURATION_MIN_EFFECTIVENESS) * Math.max(0, 1 - distance / range);
    }

    return 1;
  }

  private buildNextState(current: Emotions, deltas: Partial<Emotions>): Emotions {
    return {
      happiness: this.clamp(current.happiness + (deltas.happiness ?? 0)),
      frustration: this.clamp(current.frustration + (deltas.frustration ?? 0)),
      curiosity: this.clamp(current.curiosity + (deltas.curiosity ?? 0)),
      trust: this.clamp(current.trust + (deltas.trust ?? 0)),
      confidence: this.clamp(current.confidence + (deltas.confidence ?? 0)),
      excitement: this.clamp(current.excitement + (deltas.excitement ?? 0)),
    };
  }

  private roundDelta(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private debugTransition(
    transition: EmotionTransition,
    previous: Emotions,
    next: Emotions,
    deltas: Partial<Emotions>,
  ): void {
    if (process.env.ARCON_EMOTION_DEBUG !== "1") {
      return;
    }

    console.log("[Arcon Emotion Transition]", {
      event: transition.event,
      reason: transition.reason,
      context: transition.context,
      previous,
      deltas,
      next,
    });
  }
}
