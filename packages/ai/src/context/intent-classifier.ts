export enum IntentType {
  USER_PROFILE = "USER_PROFILE",
  ARCON_IDENTITY = "ARCON_IDENTITY",
  GENERAL = "GENERAL",
}

export function classifyIntent(
  message: string,
): IntentType {
  const text = message.toLowerCase();

  if (
    text.includes("who am i") ||
    text.includes("about me") ||
    text.includes("remember about me")
  ) {
    return IntentType.USER_PROFILE;
  }

  if (
    text.includes("who are you") ||
    text.includes("created you") ||
    text.includes("about yourself")
  ) {
    return IntentType.ARCON_IDENTITY;
  }

  return IntentType.GENERAL;
}