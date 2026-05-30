import type { LlmMemoryCandidate } from "./extraction-result.js";

export function parseExtraction(
  response: string,
): LlmMemoryCandidate[] {
  try {
    const parsed = JSON.parse(response);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as LlmMemoryCandidate[];
  } catch {
    return [];
  }
}