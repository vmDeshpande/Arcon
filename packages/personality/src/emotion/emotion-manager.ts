import { MemoryRepository } from "@arcon/memory";
import { ExperienceManager } from "../experience/experience-manager.js";
import { ExperienceType } from "../experience/experience-type.js";
import {
  EmotionEngine,
  type Emotions,
  type EmotionSnapshot,
  EMOTION_BASELINES,
  getEventImpact,
} from "./emotion-engine.js";
import { detectUserEmotion } from "./user-emotion-detector.js";
import { MoodEngine } from "../mood/mood-engine.js";

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
  private moodEngine?: MoodEngine;

  constructor(
    memoryRepo: MemoryRepository,
    experiences: ExperienceManager,
    moodEngine?: MoodEngine,
  ) {
    super(memoryRepo, experiences);
    this.moodEngine = moodEngine;
  }

  setMoodEngine(moodEngine: MoodEngine): void {
    this.moodEngine = moodEngine;
  }

  recordAssistantReply(reply: string): void {
    const askedQuestion =
      /\?\s*$/.test(reply.trim()) ||
      /\?/.test(reply);

    if (askedQuestion) {
      this.moodEngine?.recordAssistantReply(reply);
      return;
    }

    this.moodEngine?.recordAssistantReply(reply);
  }

  recordAssistantTurn(
    message: string,
    context: {
      strategy?: string;
      intent?: string;
      arconInterests: { topic: string; weight: number }[];
    } = { arconInterests: [] },
  ): EmotionSnapshot {
    const emotionEvent = this.detectArconEmotionalEvent(message, context);

    if (!emotionEvent) {
      return {
        emotions: this.getCurrentEmotions(),
        deltas: {},
        reason: "No meaningful Arcon emotional event detected",
        updatedAt: Date.now(),
      };
    }

    this.getExperiences().record(emotionEvent);

    const impact = getEventImpact(emotionEvent);
    if (Object.keys(impact).length === 0) {
      return {
        emotions: this.getCurrentEmotions(),
        deltas: {},
        reason: `Event ${emotionEvent} has no emotion impact`,
        updatedAt: Date.now(),
      };
    }

    const snapshot = this.applyTransition({
      event: "arcon_emotion",
      deltas: impact,
      reason: `Arcon response: ${message.slice(0, 100)}`,
      context: {
        strategy: context.strategy,
        intent: context.intent,
        experienceType: emotionEvent,
      },
    });

    return snapshot;
  }

  recordUserTurn(message: string): EmotionSnapshot {
    const userEmotion = detectUserEmotion(message);

    if (!userEmotion) {
      return {
        emotions: this.getCurrentEmotions(),
        deltas: {},
        reason: "No significant user emotional signal detected",
        updatedAt: Date.now(),
      };
    }

    const impact = getEventImpact(userEmotion.type);
    if (Object.keys(impact).length === 0) {
      return {
        emotions: this.getCurrentEmotions(),
        deltas: {},
        reason: `Event ${userEmotion.type} has no emotion impact`,
        updatedAt: Date.now(),
      };
    }

    const snapshot = this.applyTransition({
      event: "user_emotion",
      deltas: impact,
      reason: `User emotional signal: ${userEmotion.type}`,
      context: {
        userMessage: message.slice(0, 200),
        confidence: userEmotion.confidence,
      },
    });

    return snapshot;
  }

  increaseTrust(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { trust: amount },
      reason: "Explicit trust increase",
    });
  }

  increaseCuriosity(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { curiosity: amount },
      reason: "Explicit curiosity increase",
    });
  }

  increaseExcitement(amount = 0.05): EmotionSnapshot {
    return this.applyTransition({
      event: "arcon_emotion",
      deltas: { excitement: amount },
      reason: "Explicit excitement increase",
    });
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
    this.moodEngine?.reset();
  }

  getMoodState(): DerivedMoodState {
    const emotions = this.getCurrentEmotions();
    const mood = this.moodEngine?.getMood();

    return {
      curiosity: emotions.curiosity,
      frustration: emotions.frustration,
      askCount: mood?.askCount ?? 0,
      pendingQuestion: mood?.pendingQuestion ?? false,
      trust: emotions.trust,
      excitement: emotions.excitement,
      updatedAt: new Date().toISOString(),
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

  private detectArconEmotionalEvent(
    message: string,
    context: {
      strategy?: string;
      intent?: string;
      arconInterests: { topic: string; weight: number }[];
    },
  ): ExperienceType | null {
    const lower = message.toLowerCase();
    const strategy = (context.strategy ?? "").toLowerCase();

    if (/\?\s*$/.test(message.trim()) || /\?/.test(message)) {
      return ExperienceType.ARCON_ASKED_QUESTION;
    }

    if (/\b(congratulations|congrats|awesome|amazing|fantastic|incredible|nice|well done|that's great|so glad)\b/.test(lower)) {
      return ExperienceType.ARCON_CELEBRATED_WITH_USER;
    }

    if (/\b(sorry to hear|that sounds|rough|frustrating|tough|difficult|i understand)\b/.test(lower)) {
      return ExperienceType.ARCON_COMFORTED_USER;
    }

    if (/\b(let's|we should|we can|we'll|we are|we're)\b/.test(lower)) {
      return ExperienceType.ARCON_ACKNOWLEDGED_USER;
    }

    if (/\b(i think|i believe|in my experience|based on|the answer is|it works because|this happens because)\b/.test(lower)) {
      return ExperienceType.ARCON_PROVIDED_ANSWER;
    }

    if (strategy.includes("comfort") || context.intent === "comfort") {
      return ExperienceType.ARCON_COMFORTED_USER;
    }

    if (strategy.includes("celebrate") || context.intent === "celebrate") {
      return ExperienceType.ARCON_CELEBRATED_WITH_USER;
    }

    if (strategy.includes("encourage") || context.intent === "encourage") {
      return ExperienceType.ARCON_ACKNOWLEDGED_USER;
    }

    if (strategy === "answer" || strategy === "explain") {
      return ExperienceType.ARCON_PROVIDED_ANSWER;
    }

    if (strategy === "explore" || strategy === "follow_up") {
      return ExperienceType.ARCON_DISCUSSED_INTEREST;
    }

    if (context.arconInterests.some((interest) => {
      const topic = interest.topic.toLowerCase();
      const keywords = topic.split(/\s+/);
      return keywords.some((keyword) => keyword.length > 3 && lower.includes(keyword));
    })) {
      return ExperienceType.ARCON_DISCUSSED_INTEREST;
    }

    return null;
  }
}
