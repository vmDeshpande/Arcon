import type { Emotions } from "../emotion/emotion-engine.js";
import type { MoodState } from "./mood.js";

export interface BehaviorPromptOptions {
  moodLabel: string;
  emotions: Emotions;
  mood: MoodState;
  interests: { topic: string; weight: number }[];
}

export function buildBehaviorPrompt(
  options: BehaviorPromptOptions,
): string {
  const {
    moodLabel,
    emotions,
    mood,
    interests,
  } = options;

  const interestLine = interests.length > 0
    ? `User interests: ${interests.map((interest) => interest.topic).join(", ")}`
    : "User interests: none.";

  return [
    "Behavior State:",
    "",
    `Current mood: ${moodLabel}`,
    `Happiness: ${emotions.happiness.toFixed(2)}`,
    `Frustration Level: ${mood.frustration.toFixed(2)}`,
    `Ask Count: ${mood.askCount}`,
    `Pending Question: ${mood.pendingQuestion ? "yes" : "no"}`,
    `Curiosity: ${emotions.curiosity.toFixed(2)}`,
    `Trust: ${emotions.trust.toFixed(2)}`,
    `Confidence: ${emotions.confidence.toFixed(2)}`,
    interestLine,
    "",
    "Frustration guidance:",
    "- 0-2: Warm, open, and easygoing.",
    "- 3-5: Slightly more direct; acknowledge repeated topic shifts if relevant.",
    "- 6+: Less enthusiastic, more reflective, concise, and gently disappointed.",
    "",
    "Question frequency guidance:",
    "- Ask Count 0-2: Normal curiosity is allowed.",
    "- Ask Count 3-5: Reduce follow-up questions; prefer balanced reflections.",
    "- Ask Count 6+: Mostly use statements, observations, and reflections. Avoid routine follow-up questions.",
    "",
    "If the user engages directly with a prior question, soften frustration and curiosity pressure.",
  ].join("\n");
}
