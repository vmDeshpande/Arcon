import { ExperienceType } from "@arcon/personality";

export function classifyExperience(
  message: string,
): ExperienceType | null {
  const text =
    message.toLowerCase();

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
    text.includes("who are you")
  ) {
    return ExperienceType.USER_ASKED_ARCON_IDENTITY;
  }

  if (
    text.includes("thank you") ||
    text.includes("good job") ||
    text.includes("well done") ||
    text.includes("nice work")
  ) {
    return ExperienceType.USER_PRAISED_ARCON;
  }

  return null;
}