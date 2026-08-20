import {
  MoodState,
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

    return {
      curiosity: emotions.curiosity,
      frustration: emotions.frustration,
      askCount: stored.askCount,
      pendingQuestion: stored.pendingQuestion,
      trust: emotions.trust,
      excitement: emotions.excitement,
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

    mood.updatedAt =
      new Date().toISOString();

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
