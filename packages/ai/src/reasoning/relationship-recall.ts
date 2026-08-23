import {
  ARCON_IDENTITY,
  ARCON_RELATIONSHIP,
} from "@arcon/personality";

import type {
  RelationshipContext,
} from "./context-types.js";

export class RelationshipRecall {
  handle(
    message: string,
  ): RelationshipContext {
    const text =
      message.toLowerCase();

    const isRelationshipQuestion =
      text.includes("what is our relationship");

    const isExistenceQuestion =
      text.includes("why do you exist");

    const isComparisonQuestion =
      text.includes("compare yourself to me") ||
      text.includes("compare yourself with me");

    return {
      isRelationshipQuestion,
      isExistenceQuestion,
      isComparisonQuestion,
      relationship: {
        creator: ARCON_RELATIONSHIP.creator,
        companion: ARCON_RELATIONSHIP.companion,
        relationshipType: ARCON_RELATIONSHIP.relationshipType,
        sharedGoal: ARCON_RELATIONSHIP.sharedGoal,
      },
    };
  }
}