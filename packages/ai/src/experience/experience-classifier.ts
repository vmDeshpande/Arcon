import { ExperienceType } from "@arcon/personality";

export function classifyExperience(
  message: string,
): ExperienceType | null {
  const text =
    message.toLowerCase();

  if (
    text.includes("thank you") ||
    text.includes("good job") ||
    text.includes("well done") ||
    text.includes("nice work") ||
    text.includes("i like you") ||
    text.includes("you are learning")
  ) {
    return ExperienceType.USER_EXPRESSED_POSITIVE_FEEDBACK;
  }

  if (
    text.includes("wrong") ||
    text.includes("that's incorrect") ||
    text.includes("that is incorrect") ||
    text.includes("you forgot") ||
    text.includes("no, ")
  ) {
    return ExperienceType.USER_CORRECTED_ARCON;
  }

  if (
    text.includes("remember me") ||
    text.includes("do you remember") ||
    text.includes("test your memory") ||
    text.includes("testing your memory")
  ) {
    return ExperienceType.USER_TESTED_MEMORY;
  }

  if (
    /\b(i am|i'm)\s+(building|creating|developing|making|working on|coding|designing)\b/.test(text) ||
    /\bmy\s+project\b/.test(text) ||
    /\barcon\b/.test(text)
  ) {
    return ExperienceType.USER_SHARED_PROJECT;
  }

  if (
    /\b(i like|i love|i enjoy|i prefer|my favorite|my favourite)\b/.test(text)
  ) {
    return ExperienceType.USER_SHARED_PREFERENCE;
  }

  if (
    /\b(interests me|i am interested in|i'm interested in|curious about|want to learn|i want you to learn)\b/.test(text)
  ) {
    return ExperienceType.USER_SHOWED_INTEREST;
  }

  if (
    /\bmy\s+(father|dad|mother|mom|sister|brother|dog|pet|friend|wife|husband|partner)\b/.test(text)
  ) {
    return ExperienceType.USER_SHARED_RELATIONSHIP;
  }

  if (text.includes("who am i")) {
    return ExperienceType.USER_ASKED_IDENTITY;
  }

  if (
    text.includes(
      "what is our relationship",
    )
  ) {
    return ExperienceType.USER_ASKED_RELATIONSHIP;
  }

  if (
    text.includes("what am i building") ||
    text.includes("what project") ||
    text.includes("what are we building")
  ) {
    return ExperienceType.USER_ASKED_PROJECT;
  }

  if (
    text.includes("who are you")
  ) {
    return ExperienceType.USER_ASKED_ARCON_IDENTITY;
  }

  if (
    text.includes("do you have emotions") ||
    text.includes("what do you think about yourself") ||
    text.includes("what are your interests")
  ) {
    return ExperienceType.USER_ASKED_SELF;
  }

  return null;
}
