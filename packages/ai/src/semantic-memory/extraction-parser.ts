import {
  MemoryType,
  MemorySourceType,
} from "@arcon/memory";

import type { MemoryCandidate } from "@arcon/memory";
import { extractDomain } from "@arcon/memory";

function normalizeMemoryType(raw: unknown): MemoryType {
  if (typeof raw !== "string") {
    return MemoryType.FACT;
  }
  const normalized = raw.trim().toUpperCase();
  return Object.values(MemoryType).includes(normalized as MemoryType)
    ? (normalized as MemoryType)
    : MemoryType.FACT;
}

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      return extractJsonArray(fenceMatch[1].trim());
    }
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = trimmed.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      const repaired = candidate.replace(/,(\s*[}\]])/g, "$1");
      try {
        return JSON.parse(repaired);
      } catch {
        return undefined;
      }
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      const repaired = candidate.replace(/,(\s*[}\]])/g, "$1");
      try {
        return JSON.parse(repaired);
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function isMemoryObject(value: unknown): value is { type: unknown; content: string; confidenceScore?: number; importanceScore?: number } {
  return Boolean(value && typeof value === "object" && typeof (value as any).type === "string" && typeof (value as any).content === "string");
}

export function parseExtraction(
  response: string,
): MemoryCandidate[] {
  try {
    const json = extractJsonArray(response);

    if (json === undefined) {
      return [];
    }

    if (!Array.isArray(json)) {
      if (isMemoryObject(json)) {
        return [
          {
            type: normalizeMemoryType(json.type),
            content: json.content,
            confidenceScore:
              json.confidenceScore ?? 0.8,
            importanceScore:
              json.importanceScore ?? 5,
            sourceType:
              MemorySourceType.INFERRED,
            reasoning:
              "Semantic extraction",
            domain: extractDomain(json.content),
          },
        ];
      }
      return [];
    }

    return json.map((item) => {
      if (!isMemoryObject(item)) {
        return null;
      }

      return {
        type: normalizeMemoryType(item.type),
        content: item.content,
        confidenceScore:
          item.confidenceScore ?? 0.8,
        importanceScore:
          item.importanceScore ?? 5,
        sourceType:
          MemorySourceType.INFERRED,
        reasoning:
          "Semantic extraction",
        domain: extractDomain(item.content),
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  } catch {
    return [];
  }
}
