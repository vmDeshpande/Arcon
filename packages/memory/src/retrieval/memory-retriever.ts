import {
  Memory,
  MemoryRepository,
  MemorySourceType,
  MemoryStatus,
  MemoryType,
} from "../personal-memory.js";
import type { Entity } from "../entity/entity.js";
import { EntityFactRepository } from "../entity/entity-fact-repository.js";
import { EntityRepository } from "../entity/entity-repository.js";
import { normalizeRelationshipRelation } from "../entity/entity-relationship-extractor.js";
import { calculateMemoryScore } from "./memory-ranking.js";

export class MemoryRetriever {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly entityRepository?: EntityRepository,
    private readonly factRepository?: EntityFactRepository,
  ) {}

  retrieveRelevantMemories(
    query: string,
    limit = 10
  ): Memory[] {
    const entityMemories = this.retrieveEntityMemories(query, limit);

    if (entityMemories.length > 0) {
      return entityMemories;
    }

    const memories = this.repository
      .listMemories()
      .filter(
        (memory) =>
          memory.status !== MemoryStatus.ARCHIVED &&
          memory.status !== MemoryStatus.OBSOLETE
      );

    return memories
      .map((memory) => ({
        memory,
        score: calculateMemoryScore(memory, query)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  private retrieveEntityMemories(
    query: string,
    limit: number,
  ): Memory[] {
    if (!this.entityRepository || !this.factRepository) {
      return [];
    }

    const entity = this.resolveTargetEntity(query);

    if (!entity) {
      return [];
    }

    const graphMemories = [
      ...this.buildRelationshipMemories(entity),
      ...this.factRepository
        .getEntityFacts(entity.id)
        .map((fact) =>
          this.syntheticMemory(
            MemoryType.FACT,
            `${entity.name} ${fact.fact}`,
          ),
        ),
    ];

    const storedMemories = this.repository
      .listMemories()
      .filter(
        (memory) =>
          memory.status !== MemoryStatus.ARCHIVED &&
          memory.status !== MemoryStatus.OBSOLETE,
      )
      .filter((memory) =>
        memory.content.toLowerCase().includes(entity.name.toLowerCase()),
      );

    return this.dedupeMemories([...graphMemories, ...storedMemories]).slice(
      0,
      limit,
    );
  }

  private resolveTargetEntity(query: string): Entity | null {
    if (!this.entityRepository) {
      return null;
    }

    const relationship = this.extractUserRelationship(query);

    if (relationship) {
      const user = this.entityRepository.findByName("User");

      if (!user) {
        return null;
      }

      return this.entityRepository.resolveRelationship(user.id, relationship);
    }

    const lowerQuery = query.toLowerCase();

    return (
      this.entityRepository
        .listEntities()
        .filter((entity) => entity.name.toLowerCase() !== "user")
        .sort((a, b) => b.name.length - a.name.length)
        .find((entity) => lowerQuery.includes(entity.name.toLowerCase())) ??
      null
    );
  }

  private extractUserRelationship(query: string): string | null {
    const match = query.match(
      /\bmy\s+(father|dad|mother|mom|mum|sister|brother|friend|best friend|dog|pet dog|puppy|cat)\b/i,
    );

    if (!match) {
      return null;
    }

    return normalizeRelationshipRelation(match[1]);
  }

  private buildRelationshipMemories(entity: Entity): Memory[] {
    if (!this.entityRepository) {
      return [];
    }

    return this.entityRepository
      .getEntityRelationships(entity.id)
      .map((link) => {
        const source = this.entityRepository?.findEntityById(
          link.source_entity_id,
        );
        const target = this.entityRepository?.findEntityById(
          link.target_entity_id,
        );

        if (!source || !target) {
          return null;
        }

        return this.syntheticMemory(
          MemoryType.RELATIONSHIP,
          `${source.name}'s ${link.relation.replace(/_/g, " ")} is ${target.name}`,
        );
      })
      .filter((memory): memory is Memory => memory !== null);
  }

  private dedupeMemories(memories: Memory[]): Memory[] {
    const seen = new Set<string>();
    const unique: Memory[] = [];

    for (const memory of memories) {
      const key = `${memory.type}:${memory.content.toLowerCase()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(memory);
    }

    return unique;
  }

  private syntheticMemory(
    type: MemoryType,
    content: string,
  ): Memory {
    const now = new Date().toISOString();

    return {
      id: `graph:${type}:${content}`,
      type,
      status: MemoryStatus.ACTIVE,
      content,
      importanceScore: 8,
      confidenceScore: 1,
      sourceType: MemorySourceType.SYSTEM_OBSERVED,
      createdAt: now,
      updatedAt: now,
      tags: [],
      evidenceCount: 1,
    };
  }
}
