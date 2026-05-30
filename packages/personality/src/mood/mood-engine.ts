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
    amount = 0.05,
  ): void {
    const mood =
      this.repository.getMood();

    mood.frustration = Math.min(
      1,
      mood.frustration + amount,
    );

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
}