import { MemoryRepository } from "@arcon/memory";
import { ExperienceManager } from "../experience/experience-manager.js";
import { ExperienceType } from "../experience/experience-type.js";

import {
  EmotionEngine,
  type Emotions,
} from "./emotion-engine.js";

export interface DerivedMoodState {
  curiosity: number;
  frustration: number;
  askCount: number;
  pendingQuestion: boolean;
  trust: number;
  excitement: number;
  updatedAt: string;
}

export class EmotionManager extends EmotionEngine {
  constructor(
    memoryRepo: MemoryRepository,
    experiences: ExperienceManager,
  ) {
    super(memoryRepo, experiences);
  }

  recordAssistantReply(reply: string): void {
    const askedQuestion =
      /\?\s*$/.test(reply.trim()) ||
      /\?/.test(reply);

    if (askedQuestion) {
      this.setAskCount(
        Math.min(10, this.getAskCount() + 1),
      );
      this.setPendingQuestion(true);
      return;
    }

    this.setPendingQuestion(false);
  }

  recordUserTurn(message: string): void {
    const pending = this.getPendingQuestion();
    const engaged = this.isPositiveEngagement(message);
    const emotions = this.getCurrentEmotions();

    if (pending) {
      if (engaged) {
        this.saveEmotionState({
          ...emotions,
          frustration: this.clampEmotion(
            emotions.frustration - 0.1,
          ),
          happiness: this.clampEmotion(
            emotions.happiness + 0.02,
          ),
          trust: this.clampEmotion(
            emotions.trust + 0.01,
          ),
        });
        this.setAskCount(
          Math.max(0, this.getAskCount() - 1),
        );
      } else {
        this.saveEmotionState({
          ...emotions,
          frustration: this.clampEmotion(
            emotions.frustration + 0.1,
          ),
        });
      }

      this.setPendingQuestion(false);
      return;
    }

    if (engaged) {
      this.saveEmotionState({
        ...emotions,
        frustration: this.clampEmotion(
          emotions.frustration - 0.05,
        ),
        happiness: this.clampEmotion(
          emotions.happiness + 0.02,
        ),
        trust: this.clampEmotion(
          emotions.trust + 0.01,
        ),
      });
      this.setAskCount(
        Math.max(0, this.getAskCount() - 1),
      );
    }
  }

  increaseTrust(amount = 0.05): void {
    const emotions = this.getCurrentEmotions();
    this.saveEmotionState({
      ...emotions,
      trust: this.clampEmotion(emotions.trust + amount),
    });
  }

  increaseCuriosity(amount = 0.05): void {
    const emotions = this.getCurrentEmotions();
    this.saveEmotionState({
      ...emotions,
      curiosity: this.clampEmotion(
        emotions.curiosity + amount,
      ),
    });
  }

  increaseExcitement(amount = 0.05): void {
    const emotions = this.getCurrentEmotions();
    this.saveEmotionState({
      ...emotions,
      happiness: this.clampEmotion(
        emotions.happiness + amount,
      ),
    });
  }

  reset(): void {
    this.saveEmotionState({
      happiness: 0,
      frustration: 0,
      curiosity: 0,
      trust: 0,
      confidence: 0,
    });
    this.setAskCount(0);
    this.setPendingQuestion(false);
  }

  getMoodState(): DerivedMoodState {
    const emotions = this.getCurrentEmotions();

    return {
      curiosity: emotions.curiosity,
      frustration: Math.round(emotions.frustration * 10),
      askCount: this.getAskCount(),
      pendingQuestion: this.getPendingQuestion(),
      trust: emotions.trust,
      excitement: emotions.happiness,
      updatedAt: new Date().toISOString(),
    };
  }

  private isPositiveEngagement(message: string): boolean {
    const normalized = message.toLowerCase();

    if (normalized.trim().endsWith("?")) {
      return false;
    }

    return (
      /\b(i|me|myself)\b/.test(normalized) ||
      /\bmy\s+(hobby|hobbies|favorite|preference)\b/.test(
        normalized,
      )
    );
  }

  private getAskCount(): number {
    const row = this.getStoredEmotion("askCount");
    return Math.floor(row?.value ?? 0);
  }

  private setAskCount(value: number): void {
    this.saveAuxiliaryEmotion("askCount", value);
  }

  private getPendingQuestion(): boolean {
    const row = this.getStoredEmotion("pendingQuestion");
    return Boolean(Math.round(row?.value ?? 0));
  }

  private setPendingQuestion(value: boolean): void {
    this.saveAuxiliaryEmotion(
      "pendingQuestion",
      value ? 1 : 0,
    );
  }

  private saveAuxiliaryEmotion(
    name: string,
    value: number,
  ): void {
    this.memoryRepo.saveEmotion(
      name,
      value,
      Date.now(),
    );
  }

  private getStoredEmotion(name: string) {
    return this.memoryRepo.getEmotion(name);
  }

  private saveEmotionState(emotions: Emotions): void {
    this.saveEmotions(emotions);
  }

  private clampEmotion(value: number): number {
    return this.clamp(value);
  }
}
