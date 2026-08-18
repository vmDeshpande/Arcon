import { Thought } from "./thought";

import { DecisionType, ConfidenceLevel, ReplyStyle } from "../types/enums";

export class ThoughtBuilder {
  build(message: string): Thought {
    return {
      id: crypto.randomUUID(),

      createdAt: new Date(),

      input: message,

      context: {
        memory: {
          memoryIds: [],
          retrieved: 0,
        },

        entity: {
          entityIds: [],
          retrieved: 0,
        },

        emotion: {
          currentMood: undefined,
          emotions: {},
        },

        experience: {
          experienceIds: [],
          retrieved: 0,
        },
      },

      decision: {
        type: DecisionType.Respond,
        confidence: ConfidenceLevel.Medium,
        reason: "Initial thought",
      },

      strategy: {
        style: ReplyStyle.Natural,
        concise: false,
        askFollowUp: false,
        referenceMemory: true,
        explainReasoning: false,
      },

      metadata: {
        pipelineVersion: 1,
      },
    };
  }
}