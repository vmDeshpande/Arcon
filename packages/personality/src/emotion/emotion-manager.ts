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

  recordAssistantTurn(
    message: string,
    context: {
      strategy?: string;
      intent?: string;
      arconInterests: { topic: string; weight: number }[];
    } = { arconInterests: [] },
  ): void {
    const emotions = this.getCurrentEmotions();
    const lower = message.toLowerCase();
    const strategy = (context.strategy ?? "").toLowerCase();
    const intent = context.intent ?? "";

    let happinessDelta = 0;
    let frustrationDelta = 0;
    let curiosityDelta = 0;
    let trustDelta = 0;
    let confidenceDelta = 0;

    const askedQuestion = /\?\s*$/.test(message.trim()) || /\?/.test(message);

    if (askedQuestion) {
      curiosityDelta += 0.04;
      confidenceDelta += 0.02;
    }

    if (/\b(you're welcome|happy to help|glad to help|no problem)\b/.test(lower)) {
      trustDelta += 0.03;
      happinessDelta += 0.02;
    }

    if (/\b(congratulations|congrats|awesome|amazing|fantastic|incredible|nice|well done)\b/.test(lower)) {
      happinessDelta += 0.1;
      trustDelta += 0.04;
    }

    if (/\b(sorry to hear|that sounds|rough|frustrating|tough|difficult)\b/.test(lower)) {
      trustDelta += 0.05;
      confidenceDelta += 0.02;
      happinessDelta += 0.01;
    }

    if (/\b(let's|we should|we can|we'll|we are|we're)\b/.test(lower)) {
      trustDelta += 0.03;
      confidenceDelta += 0.02;
    }

    if (/\b(i think|i believe|in my experience|based on)\b/.test(lower)) {
      confidenceDelta += 0.03;
    }

    if (context.arconInterests.some((interest) => {
      const topic = interest.topic.toLowerCase();
      const keywords = topic.split(/\s+/);
      return keywords.some((keyword) => keyword.length > 3 && lower.includes(keyword));
    })) {
      curiosityDelta += 0.05;
      happinessDelta += 0.03;
    }

    if (strategy.includes("comfort") || intent === "comfort") {
      trustDelta += 0.05;
      confidenceDelta += 0.02;
      happinessDelta += 0.02;
    } else if (strategy.includes("celebrate") || intent === "celebrate") {
      happinessDelta += 0.1;
      trustDelta += 0.03;
    } else if (strategy.includes("encourage") || intent === "encourage") {
      happinessDelta += 0.06;
      confidenceDelta += 0.04;
    } else if (strategy.includes("explore") || intent === "explore") {
      curiosityDelta += 0.05;
      confidenceDelta += 0.02;
    }

    if (happinessDelta !== 0 || frustrationDelta !== 0 || curiosityDelta !== 0 ||
        trustDelta !== 0 || confidenceDelta !== 0) {
      this.saveEmotionState({
        happiness: this.clampEmotion(emotions.happiness + happinessDelta),
        frustration: this.clampEmotion(emotions.frustration + frustrationDelta),
        curiosity: this.clampEmotion(emotions.curiosity + curiosityDelta),
        trust: this.clampEmotion(emotions.trust + trustDelta),
        confidence: this.clampEmotion(emotions.confidence + confidenceDelta),
      });
    }
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
