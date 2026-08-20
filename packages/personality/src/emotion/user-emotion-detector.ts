import { ExperienceType } from "../experience/experience-type.js";

export interface DetectedUserEmotion {
  type: ExperienceType;
  confidence: number;
}

export function detectUserEmotion(message: string): DetectedUserEmotion | null {
  const lower = message.toLowerCase();
  const trimmed = lower.trim();

  if (/\b(excited|thrilled|pumped|stoked|can't wait|amazing|awesome|fantastic|incredible|woohoo|yay|yes|finally|done it|finished it|completed)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_EMOTIONAL_EXCITED, confidence: 0.7 };
  }

  if (/\b(frustrated|annoying|stupid|furious|angry|upset|ugh|damn|hate this|sick of|frustrating|exasperating|irritating)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_EMOTIONAL_FRUSTRATED, confidence: 0.8 };
  }

  if (/\b(confused|don't understand|what do you mean|unclear|lost|not sure what|i don't get|explain again)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_EMOTIONAL_CONFUSED, confidence: 0.7 };
  }

  if (/\b(i finally|i did it|i finished|i completed|it works|solved it|fixed it|got it working|success|working now)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_SHARED_SUCCESS, confidence: 0.8 };
  }

  if (/\b(i can't|i failed|i messed up|it broke|still broken|doesn't work|not working|failed|error|bug)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_SHARED_FAILURE, confidence: 0.7 };
  }

  if (!/\b(?:don't|do\s+not)\s+(?:like|enjoy|love|prefer)\b/.test(trimmed) &&
      (/\bi\s+(?:\w+\s+){0,2}(?:like|enjoy|love|prefer)\b|\bmy\s+favorite\b/).test(trimmed)) {
    return { type: ExperienceType.USER_SHARED_PREFERENCE, confidence: 0.8 };
  }

  if (/\b(what do you think|your opinion|do you like|how do you feel|what's your take|agree|disagree)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_ASKED_OPINION, confidence: 0.8 };
  }

  if (/\b(i trust you|i believe you|you're right|i'll try that|good idea|let's do it|sounds good)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_SHOWED_TRUST, confidence: 0.7 };
  }

  if (/\b(no, |not that|that's wrong|incorrect|that doesn't|i don't want|stop|don't do)\b/.test(trimmed)) {
    return { type: ExperienceType.USER_REJECTED_SUGGESTION, confidence: 0.6 };
  }

  return null;
}
