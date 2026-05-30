import {
  MemoryType,
  MemorySourceType,
} from "@arcon/memory";

import type { MemoryCandidate } from "@arcon/memory";

export function parseExtraction(
  response: string,
): MemoryCandidate[] {
  try {
    const json =
      JSON.parse(response);

    if (!Array.isArray(json)) {
      return [];
    }

    return json.map((item) => ({
      type: item.type as MemoryType,
      content: item.content,
      confidenceScore:
        item.confidenceScore ?? 0.8,
      importanceScore:
        item.importanceScore ?? 5,
      sourceType:
        MemorySourceType.INFERRED,
      reasoning:
        "Semantic extraction",
    }));
  } catch {
    return [];
  }
}