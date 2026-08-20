import { ExperienceType } from "@arcon/personality";

export function classifyArconExperience(
  reply: string,
  strategy: string,
  intent: string,
): ExperienceType | null {
  const lower = reply.toLowerCase();

  if (/\?\s*$/.test(reply.trim()) || /\?/.test(reply)) {
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

  if (strategy === "comfort" || intent === "comfort") {
    return ExperienceType.ARCON_COMFORTED_USER;
  }

  if (strategy === "celebrate" || intent === "celebrate") {
    return ExperienceType.ARCON_CELEBRATED_WITH_USER;
  }

  if (strategy === "encourage" || intent === "encourage") {
    return ExperienceType.ARCON_ACKNOWLEDGED_USER;
  }

  if (strategy === "answer" || strategy === "explain") {
    return ExperienceType.ARCON_PROVIDED_ANSWER;
  }

  if (strategy === "explore" || strategy === "follow_up") {
    return ExperienceType.ARCON_DISCUSSED_INTEREST;
  }

  return null;
}
