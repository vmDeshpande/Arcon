import type { MoodState } from "./mood.js";

export function buildBehaviorPrompt(
  mood: MoodState,
): string {
  return [
    "Behavior State:",
    "",
    `Frustration Level: ${mood.frustration}`,
    `Ask Count: ${mood.askCount}`,
    `Pending Question: ${mood.pendingQuestion ? "yes" : "no"}`,
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
