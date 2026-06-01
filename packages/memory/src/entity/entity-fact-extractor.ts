import type { SemanticMemory } from "../semantic/semantic-types.js";
import { isRedundantEntityOnlyMemory } from "../semantic/memory-quality.js";
import type { EntityType } from "./entity.js";
import { EntityRelationshipExtractor } from "./entity-relationship-extractor.js";

export interface ExtractedEntityFact {
  entityName: string;

  fact: string;

  inferredEntityType: EntityType;
}

export class EntityFactExtractor {
  private readonly relationshipExtractor =
    new EntityRelationshipExtractor();

  extract(
    memories: SemanticMemory[],
  ): ExtractedEntityFact[] {
    const facts: ExtractedEntityFact[] = [];

    for (const memory of memories) {
      const content = memory.content.trim();

      if (isRedundantEntityOnlyMemory(content)) {
        continue;
      }

      if (this.relationshipExtractor.extract(content)) {
        continue;
      }

      const match = content.match(
        /^([A-Z][a-zA-Z]+)\s+(.+)$/,
      );

      if (!match) {
        continue;
      }

      const entityName = match[1];

      const fact = match[2];

      if (!entityName || !fact) {
        continue;
      }

      facts.push({
        entityName,
        fact,
        inferredEntityType: this.inferEntityType(entityName, fact),
      });
    }

    return facts;
  }

  private inferEntityType(entityName: string, fact: string): EntityType {
    if (entityName.toLowerCase() === "user") {
      return "USER";
    }

    const lower = fact.toLowerCase();

    if (
      /\b(pedigree|dog food|cat food|pet food|kibble)\b/.test(lower)
    ) {
      return "PET";
    }

    if (
      /\b(is being built|being built|building|project|repository|repo)\b/.test(
        lower,
      )
    ) {
      return "PROJECT";
    }

    return "UNKNOWN";
  }
}
