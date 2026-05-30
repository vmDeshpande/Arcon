import type { SemanticMemory } from "../semantic/semantic-types.js";
import type { EntityType } from "./entity.js";

import { EntityRepository } from "./entity-repository.js";
import { EntityFactRepository } from "./entity-fact-repository.js";
import { EntityFactExtractor } from "./entity-fact-extractor.js";
import { EntityRelationshipExtractor } from "./entity-relationship-extractor.js";

export class EntityKnowledgeBuilder {
  private readonly extractor =
    new EntityFactExtractor();

  private readonly relationshipExtractor =
    new EntityRelationshipExtractor();

  constructor(
    private readonly entityRepository: EntityRepository,
    private readonly factRepository: EntityFactRepository,
  ) {}

  build(
    memories: SemanticMemory[],
  ): void {
    const relationshipEntityTypes = new Map<string, EntityType>();

    for (const memory of memories) {
      const relationship =
        this.relationshipExtractor.extract(memory.content);

      if (!relationship) {
        continue;
      }

      relationshipEntityTypes.set(
        relationship.name.toLowerCase(),
        relationship.entityType,
      );

      this.entityRepository.ensureEntity(
        relationship.name,
        relationship.entityType,
      );
    }

    const facts =
      this.extractor.extract(
        memories,
      );

    for (const fact of facts) {
      const entityType =
        relationshipEntityTypes.get(
          fact.entityName.toLowerCase(),
        ) ?? fact.inferredEntityType;

      const entity =
        this.entityRepository.ensureEntity(
          fact.entityName,
          entityType,
        );

      const existingFacts =
        this.factRepository.getFacts(
          entity.id,
        );

      const alreadyExists =
        existingFacts.some(
          (existing) =>
            existing.fact.toLowerCase() ===
            fact.fact.toLowerCase(),
        );

      if (alreadyExists) {
        continue;
      }

      this.factRepository.createFact(
        entity.id,
        fact.fact,
      );
    }
  }
}
