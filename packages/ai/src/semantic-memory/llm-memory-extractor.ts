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
    const project = this.extractProjectTarget(message);

    const repaired = memories.flatMap((memory) => {
      if (isRedundantEntityOnlyMemory(memory.content)) {
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
