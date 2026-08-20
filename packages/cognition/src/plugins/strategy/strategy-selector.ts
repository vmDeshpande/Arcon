import { Thought } from "../../thought/thought.js";
import { ResponseStrategy, ReplyStyle } from "../../types/enums.js";

export interface StrategySelection {
  strategy: ResponseStrategy;
  style: ReplyStyle;
  concise: boolean;
  askFollowUp: boolean;
  referenceMemory: boolean;
  tone: string;
  reason: string;
}

export function selectStrategy(thought: Thought): StrategySelection {
  const intent = thought.intent;
  const emotion = thought.context?.emotion?.emotions ?? {};
  const mood = thought.context?.emotion?.currentMood;
  const hasMemories = (thought.context?.memory?.retrieved ?? 0) > 0;
  const hasEntities = (thought.context?.entity?.retrieved ?? 0) > 0;

  const frustration = emotion.frustration ?? 0;
  const curiosity = emotion.curiosity ?? 0;
  const happiness = emotion.happiness ?? 0;
  const trust = emotion.trust ?? 0;

  if (intent?.goal === "greeting") {
    return {
      strategy: ResponseStrategy.Acknowledge,
      style: ReplyStyle.Friendly,
      concise: true,
      askFollowUp: false,
      referenceMemory: false,
      tone: "warm",
      reason: "User greeted; respond briefly and warmly",
    };
  }

  if (intent?.goal === "ask-question") {
    if (frustration > 0.6) {
      return {
        strategy: ResponseStrategy.Comfort,
        style: ReplyStyle.Natural,
        concise: true,
        askFollowUp: true,
        referenceMemory: hasMemories,
        tone: "supportive",
        reason: "User is frustrated and asked a question; be concise and supportive",
      };
    }

    if (curiosity > 0.6) {
      return {
        strategy: ResponseStrategy.Explore,
        style: ReplyStyle.Friendly,
        concise: false,
        askFollowUp: true,
        referenceMemory: hasMemories,
        tone: "curious",
        reason: "High curiosity; explore the question with follow-up",
      };
    }

    return {
      strategy: ResponseStrategy.Answer,
      style: ReplyStyle.Technical,
      concise: false,
      askFollowUp: false,
      referenceMemory: hasMemories,
      tone: "direct",
      reason: "Direct question; answer clearly",
    };
  }

  if (intent?.goal === "debug") {
    return {
      strategy: ResponseStrategy.Explain,
      style: ReplyStyle.Technical,
      concise: true,
      askFollowUp: true,
      referenceMemory: hasMemories,
      tone: "analytical",
      reason: "Debugging context; be direct and analytical",
    };
  }

  if (intent?.goal === "build") {
    return {
      strategy: ResponseStrategy.Encourage,
      style: ReplyStyle.Friendly,
      concise: false,
      askFollowUp: true,
      referenceMemory: hasMemories,
      tone: "enthusiastic",
      reason: "User is building something; encourage and ask about progress",
    };
  }

  if (intent?.goal === "remember") {
    return {
      strategy: ResponseStrategy.Recall,
      style: ReplyStyle.Natural,
      concise: false,
      askFollowUp: false,
      referenceMemory: true,
      tone: "reflective",
      reason: "Memory-related question; recall relevant memories",
    };
  }

  if (frustration > 0.6) {
    return {
      strategy: ResponseStrategy.Comfort,
      style: ReplyStyle.Natural,
      concise: true,
      askFollowUp: true,
      referenceMemory: hasMemories,
      tone: "supportive",
      reason: "User frustration is high; provide comfort and concise support",
    };
  }

  if (happiness > 0.6) {
    return {
      strategy: ResponseStrategy.Celebrate,
      style: ReplyStyle.Friendly,
      concise: false,
      askFollowUp: true,
      referenceMemory: hasMemories,
      tone: "enthusiastic",
      reason: "User is happy; celebrate and build on positive energy",
    };
  }

  if (curiosity > 0.6 && trust > 0.5) {
    return {
      strategy: ResponseStrategy.Explore,
      style: ReplyStyle.Friendly,
      concise: false,
      askFollowUp: true,
      referenceMemory: hasMemories,
      tone: "curious",
      reason: "High curiosity and trust; explore the topic naturally",
    };
  }

  if (hasMemories && hasEntities) {
    return {
      strategy: ResponseStrategy.Agree,
      style: ReplyStyle.Natural,
      concise: false,
      askFollowUp: true,
      referenceMemory: true,
      tone: "warm",
      reason: "Relevant memories and active entities; reference context naturally",
    };
  }

  if (hasMemories) {
    return {
      strategy: ResponseStrategy.FollowUp,
      style: ReplyStyle.Natural,
      concise: false,
      askFollowUp: true,
      referenceMemory: true,
      tone: "warm",
      reason: "Relevant memories available; follow up with context",
    };
  }

  return {
    strategy: ResponseStrategy.Acknowledge,
    style: ReplyStyle.Natural,
    concise: false,
    askFollowUp: curiosity > 0.4,
    referenceMemory: false,
    tone: "neutral",
    reason: "Default: acknowledge and respond naturally",
  };
}
