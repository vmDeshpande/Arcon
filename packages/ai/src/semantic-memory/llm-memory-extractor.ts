import type { AiClient, ChatMessage } from "@arcon/shared";
import {
  MemorySourceType,
  MemoryType,
} from "@arcon/memory";
import type {
  ConversationEntity,
  MemoryCandidate,
} from "@arcon/memory";

import { parseExtraction } from "./extraction-parser.js";
import { buildExtractionPrompt } from "./extraction-prompt.js";

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

    // console.log("RAW EXTRACTION:");
    // console.log(response);

    return this.repairExtraction(
      message,
      parseExtraction(response),
    );
  }

  private repairExtraction(
    message: string,
    memories: MemoryCandidate[],
  ): MemoryCandidate[] {
    const identityName = this.extractIdentityName(message);

    const repaired = memories.map((memory) => {
      const identityResolvedMemory =
        identityName && memory.content.startsWith(`${identityName} `)
          ? {
              ...memory,
              content: memory.content.replace(identityName, "User"),
            }
          : memory;

      if (
        identityResolvedMemory.type === MemoryType.FACT &&
        /\b(likes|loves|prefers|dislikes)\b/i.test(
          identityResolvedMemory.content,
        )
      ) {
        return {
          ...identityResolvedMemory,
          type: MemoryType.PREFERENCE,
        };
      }

      return identityResolvedMemory;
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

    return repaired;
  }

  private extractRelationshipMemories(
    message: string,
  ): MemoryCandidate[] {
    const patterns = [
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
          /\b(?:my\s+name\s+is|i\s+am)\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "self",
      },
      {
        regex:
          /\bi(?:\s+am|\s*'m)?\s+(?:building|working\s+on|creating|developing)\s+([A-Z][a-zA-Z]*)\b/i,
        relation: "building",
      },
    ];

    return patterns.flatMap((pattern) => {
      const match = message.match(pattern.regex);

      if (!match) {
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
    const match = message.match(
      /\b(?:my\s+name\s+is|i\s+am)\s+([A-Z][a-zA-Z]*)\b/i,
    );

    return match?.[1] ?? null;
  }
}
