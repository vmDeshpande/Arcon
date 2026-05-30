export enum ExperienceType {
  USER_ASKED_IDENTITY =
    "USER_ASKED_IDENTITY",

  USER_ASKED_RELATIONSHIP =
    "USER_ASKED_RELATIONSHIP",

  USER_ASKED_ARCON_IDENTITY =
    "USER_ASKED_ARCON_IDENTITY",
}

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

  return null;
}