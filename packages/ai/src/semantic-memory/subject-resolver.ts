import type { SemanticMemory } from "@arcon/memory";

import { SubjectExtractor } from "./subject-extractor.js";

export class SubjectResolver {
  private readonly extractor =
    new SubjectExtractor();

  resolve(
    memories: SemanticMemory[],
  ): SemanticMemory[] {
    return memories.map((memory) => {
      const result =
        this.extractor.extract(
          memory.content,
        );

      if (!result.subject) {
        return memory;
      }

      return {
        ...memory,
        content: `${result.subject} ${result.predicate}`,
      };
    });
  }
}