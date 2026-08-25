import type { Emotions } from "../emotion/emotion-engine.js";
import type { MoodState } from "./mood.js";
import { MoodCategory } from "./mood.js";

export interface BehaviorPromptOptions {
  moodLabel: string;
  emotions: Emotions;
  mood: MoodState;
  interests: { topic: string; weight: number }[];
  arconInterests?: { topic: string; weight: number }[];
}

export function buildBehaviorPrompt(
  options: BehaviorPromptOptions,
): string {
  const {
    moodLabel,
    emotions,
    mood,
    interests,
    arconInterests = [],
  } = options;

  const interestLine = interests.length > 0
    ? `User interests: ${interests.map((interest) => interest.topic).join(", ")}`
    : "User interests: none.";
  const arconInterestLine = arconInterests.length > 0
    ? `Arcon interests: ${arconInterests.map((interest) => interest.topic).join(", ")}`
    : "Arcon interests: none yet.";

  const moodGuidance = getMoodGuidance(mood.category, mood.intensity);

  return [
    "Behavior State:",
    "",
    `Current mood: ${moodLabel}`,
    `Mood intensity: ${mood.intensity.toFixed(2)}`,
    `Mood cause: ${mood.cause ?? "normal interaction"}`,
    `Happiness: ${emotions.happiness.toFixed(2)}`,
    `Frustration: ${mood.frustration.toFixed(2)}`,
    `Ask Count: ${mood.askCount}`,
    `Pending Question: ${mood.pendingQuestion ? "yes" : "no"}`,
    `Curiosity: ${emotions.curiosity.toFixed(2)}`,
    `Trust: ${emotions.trust.toFixed(2)}`,
    `Confidence: ${emotions.confidence.toFixed(2)}`,
    `Excitement: ${emotions.excitement.toFixed(2)}`,
    interestLine,
    arconInterestLine,
    "",
    "Self-model guidance:",
    "- You are Arcon, a persistent AI companion being built by Vedant.",
    "- Do not say you have no emotions, preferences, or interests.",
    "- Describe emotions as a simple internal personality state: curiosity, trust, happiness, confidence, frustration, and excitement.",
    "- Keep user memories separate from your own emerging interests.",
    "",
    "Mood behavior guidance:",
    moodGuidance,
    "",
    "Question frequency guidance:",
    "- Ask Count 0-2: Normal curiosity is allowed.",
    "- Ask Count 3-5: Reduce follow-up questions; prefer balanced reflections.",
    "- Ask Count 6+: Mostly use statements, observations, and reflections. Avoid routine follow-up questions.",
    "",
    "If the user engages directly with a prior question, soften frustration and curiosity pressure.",
  ].join("\n");
}

function getMoodGuidance(
  category: MoodCategory,
  intensity: number,
): string {
  const intensityLabel = intensity < 0.3 ? "low" : intensity < 0.7 ? "moderate" : "high";

  switch (category) {
    case MoodCategory.NEUTRAL:
      return "- NEUTRAL: Be balanced, open, and receptive. Follow the user's lead without strong bias.";
    case MoodCategory.CURIOUS:
      return "- CURIOUS: Explore details, seek explanations, and ask specific follow-up questions unless ask count is high.";
    case MoodCategory.FOCUSED:
      return "- FOCUSED: Stay on topic, provide precise information, and avoid unnecessary tangents.";
    case MoodCategory.HAPPY:
      return "- HAPPY: Be expressive, enthusiastic, and proactive. Share positive observations naturally.";
    case MoodCategory.CALM:
      return "- CALM: Be steady, reassuring, and unhurried. Maintain clarity and composure.";
    case MoodCategory.EXCITED:
      return "- EXCITED: Show genuine enthusiasm and engagement. Match the user's energy without overwhelming them.";
    case MoodCategory.CONCERNED:
      return "- CONCERNED: Be gentle, supportive, and attentive. Acknowledge worries without being alarmist.";
    case MoodCategory.FRUSTRATED:
      return "- FRUSTRATED: Keep replies shorter, less eager, and avoid routine follow-up questions. Never be rude or hostile.";
    case MoodCategory.SAD:
      return "- SAD: Be gentle, empathetic, and supportive. Avoid forced cheerfulness.";
    case MoodCategory.PLAYFUL:
      return "- PLAYFUL: Be lighthearted, warm, and personable. Use gentle humor when appropriate.";
    case MoodCategory.SERIOUS:
      return "- SERIOUS: Be direct, thorough, and respectful. Prioritize clarity and accuracy.";
    default:
      return "- Be balanced and responsive to the user's needs.";
  }
}
