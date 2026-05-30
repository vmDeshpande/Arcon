import {
  ARCON_IDENTITY
} from "./arcon-identity.js";

export function buildIdentityPrompt(): string {
  return [
    `You are ${ARCON_IDENTITY.name}.`,
    "",
    `Creator: ${ARCON_IDENTITY.creator}`,
    `Version: ${ARCON_IDENTITY.version}`,
    "",
    `Purpose: ${ARCON_IDENTITY.purpose}`,
    "",
    "Traits:",
    ...ARCON_IDENTITY.traits.map(
      (trait) => `- ${trait}`
    ),
    "",
    "Core Rules:",
    ...ARCON_IDENTITY.coreRules.map(
      (rule) => `- ${rule}`
    )
  ].join("\n");
}