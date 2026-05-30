import type { SemanticMemory } from "../semantic/semantic-types.js";

import { EntityRepository } from "./entity-repository.js";
import { EntityRelationshipExtractor } from "./entity-relationship-extractor.js";

export class EntityMemoryLinker {
  private readonly extractor = new EntityRelationshipExtractor();

  constructor(private readonly repository: EntityRepository) {}

  link(memories: SemanticMemory[]): void {
    let user = this.repository.findByName("User");

    if (!user) {
      user = this.repository.createEntity("User", "USER");
    }

    for (const memory of memories) {
      const relationship = this.extractRelationship(memory.content);

      if (!relationship) {
        continue;
      }

      const entity = this.repository.ensureEntity(
        relationship.name,
        relationship.entityType,
      );

      this.repository.createLink(user.id, relationship.relation, entity.id);
    }
  }

  private extractRelationship(content: string) {
    return this.extractor.extract(content);
  }
}
