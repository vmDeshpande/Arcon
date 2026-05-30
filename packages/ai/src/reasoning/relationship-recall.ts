import {
  ARCON_IDENTITY,
  ARCON_RELATIONSHIP,
} from "@arcon/personality";

import type {
  RecallResult,
} from "./identity-recall.js";

export class RelationshipRecall {
  handle(
    message: string,
  ): RecallResult {
    const text =
      message.toLowerCase();

    if (
      text.includes(
        "what is our relationship",
      )
    ) {
      return {
        handled: true,
        reply: [
          `You are ${ARCON_RELATIONSHIP.creator}.`,
          `I am ${ARCON_RELATIONSHIP.companion}.`,
          "",
          `Our relationship is: ${ARCON_RELATIONSHIP.relationshipType}.`,
        ].join("\n"),
      };
    }

    if (
      text.includes(
        "why do you exist",
      )
    ) {
      return {
        handled: true,
        reply: [
          `I exist because ${ARCON_RELATIONSHIP.creator} is building me.`,
          "",
          ARCON_IDENTITY.purpose,
        ].join("\n"),
      };
    }

    if (
      text.includes(
        "compare yourself to me",
      ) ||
      text.includes(
        "compare yourself with me",
      )
    ) {
      return {
        handled: true,
        reply: [
          `You are ${ARCON_RELATIONSHIP.creator}.`,
          `I am ${ARCON_RELATIONSHIP.companion}.`,
          "",

          "You are a human developer building Arcon.",
          "I am the AI companion being built.",

          "",

          "You have real-world experiences.",
          "I learn through memory and interaction.",

          "",

          `Our shared goal is: ${ARCON_RELATIONSHIP.sharedGoal}.`,
        ].join("\n"),
      };
    }

    return {
      handled: false,
    };
  }
}