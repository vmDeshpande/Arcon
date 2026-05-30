import type { Entity } from "./entity.js";
import type { EntityFact } from "./entity-fact.js";
import { EntityFactRepository } from "./entity-fact-repository.js";
import {
  EntityLinkRow,
  EntityRepository,
} from "./entity-repository.js";
import { normalizeRelationshipRelation } from "./entity-relationship-extractor.js";

export class EntityGraphQuery {
  constructor(
    private readonly entityRepository: EntityRepository,
    private readonly factRepository: EntityFactRepository,
  ) {}

  getEntityByName(name: string): Entity | null {
    return this.entityRepository.getEntityByName(name);
  }

  getEntityFacts(entityId: string): EntityFact[] {
    return this.factRepository.getEntityFacts(entityId);
  }

  getEntityRelationships(entityId: string): EntityLinkRow[] {
    return this.entityRepository.getEntityRelationships(entityId);
  }

  getRelatedEntities(entityId: string): Entity[] {
    return this.entityRepository.getRelatedEntities(entityId);
  }

  resolveRelationship(
    userId: string,
    relation: string,
  ): Entity | null {
    return this.entityRepository.resolveRelationship(
      userId,
      normalizeRelationshipRelation(relation),
    );
  }
}
