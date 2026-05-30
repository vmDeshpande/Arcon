import type { SemanticMemory } from "../semantic/semantic-types.js";
import type { EntityType } from "../entity/entity.js";
import { EntityRelationshipExtractor } from "../entity/entity-relationship-extractor.js";
import type { EntityRepository } from "../entity/entity-repository.js";

import type { ConversationEntity } from "./conversation-entity.js";

export class ConversationEntityTracker {
  private activeEntity: ConversationEntity | null = null;

  private readonly relationshipExtractor =
    new EntityRelationshipExtractor();

  constructor(
    private readonly entityRepository?: EntityRepository,
  ) {}

  update(memories: SemanticMemory[]): void {
    for (const memory of memories) {
      const content = memory.content;

      const relationship =
        this.relationshipExtractor.extract(content);

      if (relationship) {
        this.activeEntity = {
          name: relationship.name,
          type: this.toConversationEntityType(
            relationship.entityType,
          ),
          lastMentionedAt: new Date().toISOString(),
        };

        return;
      }

      // =====================================
      // Direct entity facts
      // Sonali likes tea
      // Murphy likes dog food
      // Milind works at Infosys
      // =====================================

      const entityMatch = content.match(/^([A-Z][a-zA-Z]+)\s+/);

      if (entityMatch) {
        const entityName = entityMatch[1];

        const existingEntity =
          this.entityRepository?.findByName(
            entityName,
          );

        this.activeEntity = {
          name: entityName,
          type: this.toConversationEntityType(
            existingEntity?.type ?? "UNKNOWN",
          ),
          lastMentionedAt: new Date().toISOString(),
        };

        return;
      }
    }
  }

  getActiveEntity(): ConversationEntity | null {
    return this.activeEntity;
  }

  clear(): void {
    this.activeEntity = null;
  }

  private toConversationEntityType(
    entityType: EntityType,
  ): ConversationEntity["type"] {
    if (
      entityType === "PERSON" ||
      entityType === "PET" ||
      entityType === "PROJECT" ||
      entityType === "PLACE"
    ) {
      return entityType;
    }

    return "UNKNOWN";
  }
}
