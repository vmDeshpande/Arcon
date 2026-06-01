import {
  MoodState,
} from "./mood.js";

import {
  MoodRepository,
} from "./mood-repository.js";

export class MoodEngine {
  constructor(
    private readonly repository:
      MoodRepository,
  ) {}

  getMood(): MoodState {
    return this.repository.getMood();
  }

  increaseCuriosity(
    amount = 0.05,
  ): void {
    const mood =
      this.repository.getMood();

    mood.curiosity = Math.min(
      1,
      mood.curiosity + amount,
    );

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  increaseFrustration(
    amount = 1,
  ): void {
    const mood =
      this.repository.getMood();

    mood.frustration = Math.min(
      10,
      mood.frustration + amount,
    );

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  decreaseFrustration(
    amount = 1,
  ): void {
    const mood =
      this.repository.getMood();

    mood.frustration = Math.max(
      0,
      mood.frustration - amount,
    );

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  recordAssistantReply(
    reply: string,
  ): void {
    const mood =
      this.repository.getMood();

    const askedQuestion =
      /\?\s*$/.test(reply.trim()) ||
      /\?/.test(reply);

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
  ): void {
    const mood =
      this.repository.getMood();

    const engaged =
      this.isPositiveEngagement(message);

    if (mood.pendingQuestion) {
      if (engaged) {
        mood.frustration = Math.max(
          0,
          mood.frustration - 1,
        );
        mood.askCount = Math.max(
          0,
          mood.askCount - 1,
        );
      } else {
        mood.frustration = Math.min(
          10,
          mood.frustration + 1,
        );
      }

      mood.pendingQuestion = false;
    } else if (engaged) {
      mood.frustration = Math.max(
        0,
        mood.frustration - 0.5,
      );
      mood.askCount = Math.max(
        0,
        mood.askCount - 1,
      );
    }

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  increaseTrust(
    amount = 0.05,
  ): void {
    const mood =
      this.repository.getMood();

    mood.trust = Math.min(
      1,
      mood.trust + amount,
    );

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  increaseExcitement(
    amount = 0.05,
  ): void {
    const mood =
      this.repository.getMood();

    mood.excitement = Math.min(
      1,
      mood.excitement + amount,
    );

    mood.updatedAt =
      new Date().toISOString();

    this.repository.saveMood(mood);
  }

  reset(): void {
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
