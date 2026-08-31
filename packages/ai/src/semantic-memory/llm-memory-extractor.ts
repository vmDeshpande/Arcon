import type { AiClient, ChatMessage } from "@arcon/shared";
import {
  isBlockedUserIdentityName,
  isRedundantEntityOnlyMemory,
  MemorySourceType,
  MemoryType,
} from "@arcon/memory";
import type {
  ConversationEntity,
  MemoryCandidate,
} from "@arcon/memory";

import { parseExtraction } from "./extraction-parser.js";
import { buildExtractionPrompt } from "./extraction-prompt.js";
import { stripThinkTokens } from "../utils/strip-think-tokens.js";

export class LlmMemoryExtractor {
  constructor(private readonly aiClient: AiClient) {}

  async extract(message: string, activeEntity?: ConversationEntity | null) {
    const prompt = buildExtractionPrompt(message, activeEntity);

    const messages: ChatMessage[] = [
      {
        conversationId: "memory",
        role: "system",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];

    const response = await this.aiClient.generateReply(messages);
    const cleanedResponse = stripThinkTokens(response);

    return this.repairExtraction(
      message,
      parseExtraction(cleanedResponse),
    );
  }

  private repairExtraction(
    message: string,
    memories: MemoryCandidate[],
  ): MemoryCandidate[] {
    if (isHypothetical(message) || isQuestionOnly(message) || isAssistantLike(message)) {
      return [];
    }

    const identityName = this.extractIdentityName(message);
    const project = this.extractProjectTarget(message);

    const repaired = memories.flatMap((memory) => {
      if (isRedundantEntityOnlyMemory(memory.content)) {
        return [];
      }

      if (isHypotheticalMemory(memory.content) || isQuestionLikeMemory(memory.content)) {
        return [];
      }

      if (
        project &&
        memory.type === MemoryType.PROJECT &&
        /^user is (?:building|creating|developing|making|coding|designing|working on) /i.test(
          memory.content,
        )
      ) {
        return [
          {
            ...memory,
            type: MemoryType.FACT,
            content: `${project} is being built`,
          },
        ];
      }

      const identityResolvedMemory =
        identityName && memory.content.startsWith(`${identityName} `)
          ? {
              ...memory,
              content: memory.content.replace(identityName, "User"),
            }
          : memory;

      if (this.isBlockedSelfRelationship(identityResolvedMemory)) {
        return [];
      }

      if (
        identityResolvedMemory.type === MemoryType.FACT &&
        /\b(likes|loves|prefers|dislikes)\b/i.test(
          identityResolvedMemory.content,
        )
      ) {
        return [
          {
            ...identityResolvedMemory,
            type: MemoryType.PREFERENCE,
          },
        ];
      }

      return [identityResolvedMemory];
    });

    for (const relationship of this.extractRelationshipMemories(message)) {
      const alreadyExists = repaired.some(
        (memory) =>
          memory.type === MemoryType.RELATIONSHIP &&
          memory.content.toLowerCase() ===
            relationship.content.toLowerCase(),
      );

      if (alreadyExists) {
        continue;
      }

      repaired.unshift(relationship);
    }

    if (project) {
      const projectFact = `${project} is being built`;
      const alreadyExists = repaired.some(
        (memory) =>
          memory.content.toLowerCase() === projectFact.toLowerCase(),
      );

      if (!alreadyExists) {
        repaired.push({
          type: MemoryType.FACT,
          content: projectFact,
          confidenceScore: 0.95,
          importanceScore: 7,
          sourceType: MemorySourceType.INFERRED,
          reasoning: "Project fact recovered from project action phrase",
        });
      }
    }

    return repaired;
  }

  private extractRelationshipMemories(
    message: string,
  ): MemoryCandidate[] {
    const patterns = [
      {
        regex:
          /\b[iI](?:\s+am|\s*'m)?\s+(?:building|creating|developing|making|coding|designing|working\s+on)\s+([A-Z][a-zA-Z]*)\b/,
        relation: "building",
      },
      {
        regex:
          /\bmy\s+(?:dad|father)\s*(?:'?s\s+name\s+)?is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "father",
      },
      {
        regex:
          /\bmy\s+(?:mom|mum|mother)\s*(?:'?s\s+name\s+)?is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "mother",
      },
      {
        regex:
          /\bmy\s+sister'?s\s+name\s+is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "sister",
      },
      {
        regex:
          /\bmy\s+brother'?s\s+name\s+is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "brother",
      },
      {
        regex:
          /\bmy\s+(?:dog|pet dog|puppy)\s*(?:'?s\s+name\s+)?is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "dog",
      },
      {
        regex:
          /\bmy\s+cat'?s\s+name\s+is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "cat",
      },
      {
        regex:
          /\bmy\s+name\s+is\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "self",
      },
      {
        regex:
          /\b[iI]\s+am\s+([A-Z][a-zA-Z]*)\b/,
        relation: "self",
      },
    ];

    return patterns.flatMap((pattern) => {
      const match = message.match(pattern.regex);

      if (!match) {
        return [];
      }

      if (
        pattern.relation === "self" &&
        isBlockedUserIdentityName(match[1])
      ) {
        return [];
      }

      return [
        {
          type: MemoryType.RELATIONSHIP,
          content: `User's ${pattern.relation} is ${match[1]}`,
          confidenceScore: 0.95,
          importanceScore: 8,
          sourceType: MemorySourceType.INFERRED,
          reasoning:
            "Relationship recovered from explicit named relationship phrase",
        },
      ];
    });
  }

  private extractIdentityName(message: string): string | null {
    const match =
      message.match(/\bmy\s+name\s+is\s+([A-Z][a-zA-Z]*)\b/i) ??
      message.match(/\b[iI]\s+am\s+([A-Z][a-zA-Z]*)\b/);

    if (!match || isBlockedUserIdentityName(match[1])) {
      return null;
    }

    return match[1];
  }

  private extractProjectTarget(message: string): string | null {
    const match = message.match(
      /\b[iI](?:\s+am|\s*'m)?\s+(?:building|creating|developing|making|coding|designing|working\s+on)\s+([A-Z][a-zA-Z]*)\b/,
    );

    return match?.[1] ?? null;
  }

  private isBlockedSelfRelationship(memory: MemoryCandidate): boolean {
    if (memory.type !== MemoryType.RELATIONSHIP) {
      return false;
    }

    const match = memory.content.match(/^User's self is ([a-z][a-zA-Z]*)$/i);

    return Boolean(match && isBlockedUserIdentityName(match[1]));
  }
}

const HYPOTHETICAL_PATTERNS = [
  /^if\s+.*\s+then\s+/i,
  /^if\s+i\s+were\s+to\b/i,
  /^suppose\s+/i,
  /^what\s+if\s+/i,
  /^imagine\s+/i,
  /^hypothetically/i,
  /^let's\s+say\s+/i,
  /^for\s+example/i,
  /^e\.g\./i,
  /\bwould\s+you\b/i,
  /\bcould\s+you\b/i,
  /\bshould\s+you\b/i,
];

const QUESTION_PATTERNS = [
  /^what\s+is\s+the\s+weather/i,
  /^how\s+are\s+you/i,
  /^what\s+do\s+you\s+think/i,
  /^what\s+is\s+your\s+name/i,
  /^who\s+are\s+you/i,
  /^what\s+can\s+you\s+do/i,
];

const ASSISTANT_PATTERNS = [
  /^as\s+an\s+ai/i,
  /^i\s+am\s+an?\s+ai\b/i,
  /^i\s+don't\s+have\s+(?:feelings|emotions|personal)/i,
  /^i\s+cannot\b/i,
  /^i\s+can't\b/i,
];

function isHypothetical(message: string): boolean {
  return HYPOTHETICAL_PATTERNS.some((pattern) => pattern.test(message));
}

function isQuestionOnly(message: string): boolean {
  const isQuestion = message.trim().endsWith("?");
  if (!isQuestion) {
    return false;
  }

  return QUESTION_PATTERNS.some((pattern) => pattern.test(message));
}

function isAssistantLike(message: string): boolean {
  return ASSISTANT_PATTERNS.some((pattern) => pattern.test(message));
}

function isHypotheticalMemory(content: string): boolean {
  return HYPOTHETICAL_PATTERNS.some((pattern) => pattern.test(content));
}

function isQuestionLikeMemory(content: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(content));
}
