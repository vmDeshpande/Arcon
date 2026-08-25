import {
  MoodState,
  MoodCategory,
  createDefaultMood,
} from "./mood.js";

import {
  MoodRepository,
} from "./mood-repository.js";

import {
  EmotionEngine,
  type EmotionSnapshot,
  type Emotions,
} from "../emotion/emotion-engine.js";

export class MoodEngine {
  private readonly repository: MoodRepository;
  private readonly emotionEngine: EmotionEngine;

  constructor(
    repository: MoodRepository,
    emotionEngine: EmotionEngine,
  ) {
    this.repository = repository;
    this.emotionEngine = emotionEngine;
  }

  getMood(): MoodState {
    const emotions = this.emotionEngine.getCurrentEmotions();
    const stored = this.repository.getMood();
    const category = this.classifyMood(emotions, stored);

    return {
      category,
      intensity: stored.intensity,
      curiosity: emotions.curiosity,
      frustration: emotions.frustration,
      askCount: stored.askCount,
      pendingQuestion: stored.pendingQuestion,
      trust: emotions.trust,
      excitement: emotions.excitement,
      cause: stored.cause,
      updatedAt: new Date().toISOString(),
    };
  }

  getEmotionSnapshot(): EmotionSnapshot {
    return this.emotionEngine.getEmotionSnapshot();
  }

  increaseCuriosity(
    amount = 0.05,
  ): EmotionSnapshot {
    return this.emotionEngine.increaseCuriosity(amount);
  }

  increaseFrustration(
    amount = 1,
  ): EmotionSnapshot {
    return this.emotionEngine.applyTransition({
      event: "arcon_emotion",
      deltas: { frustration: amount / 10 },
      reason: "Explicit frustration increase",
    });
  }

  decreaseFrustration(
    amount = 1,
  ): EmotionSnapshot {
    return this.emotionEngine.applyTransition({
      event: "arcon_emotion",
      deltas: { frustration: -amount / 10 },
      reason: "Explicit frustration decrease",
    });
  }

  recordAssistantReply(
    reply: string,
  ): void {
    const askedQuestion =
      /\?\s*$/.test(reply.trim()) ||
      /\?/.test(reply);

    const mood = this.repository.getMood();

    if (askedQuestion) {
      mood.askCount = Math.min(
        10,
        mood.askCount + 1,
      );
      mood.pendingQuestion = true;
    } else {
      mood.pendingQuestion = false;
    }

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  recordUserTurn(
    message: string,
  ): EmotionSnapshot {
    const mood = this.repository.getMood();
    const snapshot = this.emotionEngine.recordUserTurn(message);

    if (mood.pendingQuestion) {
      const engaged = this.isPositiveEngagement(message);

      if (engaged) {
        mood.askCount = Math.max(
          0,
          mood.askCount - 1,
        );
      } else {
        this.emotionEngine.applyTransition({
          event: "user_emotion",
          deltas: { frustration: 0.05 },
          reason: "User ignored a pending question",
        });
        mood.askCount = Math.max(
          0,
          mood.askCount - 1,
        );
      }

      mood.pendingQuestion = false;
    } else if (this.isPositiveEngagement(message)) {
      mood.askCount = Math.max(
        0,
        mood.askCount - 1,
      );
    }

    const emotions = this.emotionEngine.getCurrentEmotions();
    const newCategory = this.classifyMood(emotions, mood);
    const cause = this.inferCause(message, newCategory);

    mood.category = newCategory;
    mood.intensity = this.calculateIntensity(emotions);
    mood.cause = cause;
    mood.updatedAt = new Date().toISOString();

    this.repository.saveMood(mood);

    return snapshot;
  }

  increaseTrust(
    amount = 0.05,
  ): EmotionSnapshot {
    return this.emotionEngine.increaseTrust(amount);
  }

  increaseExcitement(
    amount = 0.05,
  ): EmotionSnapshot {
    return this.emotionEngine.increaseExcitement(amount);
  }

  reset(): void {
    this.emotionEngine.reset();
    this.repository.reset();
  }

  private classifyMood(
    emotions: Emotions,
    mood: MoodState,
  ): MoodCategory {
    if (emotions.frustration > 0.6) {
      return MoodCategory.FRUSTRATED;
    }

    if (emotions.happiness > 0.6 && emotions.trust > 0.5) {
      return MoodCategory.HAPPY;
    }

    if (emotions.curiosity > 0.6) {
      return MoodCategory.CURIOUS;
    }

    if (emotions.confidence > 0.6) {
      return MoodCategory.SERIOUS;
    }

    if (emotions.trust < 0.3 && emotions.frustration > 0.3) {
      return MoodCategory.CONCERNED;
    }

    if (emotions.happiness > 0.4) {
      return MoodCategory.PLAYFUL;
    }

    if (emotions.excitement > 0.6) {
      return MoodCategory.EXCITED;
    }

    return MoodCategory.NEUTRAL;
  }

  private calculateIntensity(
    emotions: Emotions,
  ): number {
    const values = Object.values(emotions);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    return Math.min(1, Math.max(0, range * 2));
  }

  private inferCause(
    message: string,
    category: MoodCategory,
  ): string {
    const normalized = message.toLowerCase();

    if (category === MoodCategory.FRUSTRATED) {
      if (/\b(angry|furious|upset|annoyed|irritated)\b/.test(normalized)) {
        return "user expressed frustration";
      }
      return "interaction difficulty";
    }

    if (category === MoodCategory.HAPPY) {
      if (/\b(great|awesome|amazing|wonderful|fantastic|excellent)\b/.test(normalized)) {
        return "user shared positive news";
      }
      return "positive engagement";
    }

    if (category === MoodCategory.CURIOUS) {
      if (/\?/.test(normalized)) {
        return "user asked a question";
      }
      return "exploratory conversation";
    }

    if (category === MoodCategory.EXCITED) {
      if (/\b(excited|amazing|awesome|incredible|wow)\b/.test(normalized)) {
        return "user expressed excitement";
      }
      return "high-engagement topic";
    }

    if (category === MoodCategory.CONCERNED) {
      if (/\b(worried|concerned|problem|issue|trouble|help)\b/.test(normalized)) {
        return "user raised a concern";
      }
      return "low trust environment";
    }

    if (category === MoodCategory.PLAYFUL) {
      if (/\b(haha|lol|funny|joke|play|game)\b/.test(normalized)) {
        return "user was playful";
      }
      return "lighthearted interaction";
    }

    return "normal interaction";
  }

  private isPositiveEngagement(
    message: string,
  ): boolean {
    const normalized =
      message.toLowerCase();

    if (normalized.trim().endsWith("?")) {
      return false;
    }

    return (
      /\b(i|me|myself)\b/.test(normalized) ||
      /\bmy\s+(hobby|hobbies|favorite|preference)\b/.test(normalized)
    );
  }
}
