import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type { EntityFact } from "./entity-fact.js";

interface EntityFactRow {
  id: string;

  entity_id: string;

  fact: string;

  created_at: string;
}

export class EntityFactRepository {
  constructor(
    private readonly db: Database.Database,
  ) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_facts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  createFact(
    entityId: string,
    fact: string,
  ): EntityFact {
    const entityFact: EntityFact = {
      id: randomUUID(),
      entityId,
      fact,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO entity_facts (
          id,
          entity_id,
          fact,
          created_at
        )
        VALUES (
          @id,
          @entityId,
          @fact,
          @createdAt
        )
      `)
      .run(entityFact);

    return entityFact;
  }

  getFacts(
    entityId: string,
  ): EntityFact[] {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM entity_facts
        WHERE entity_id = ?
      `)
      .all(entityId) as EntityFactRow[];

    return rows.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      fact: row.fact,
      createdAt: row.created_at,
    }));
  }

  getEntityFacts(
    entityId: string,
  ): EntityFact[] {
    return this.getFacts(entityId);
  }

  listFacts(): EntityFact[] {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM entity_facts
      `)
      .all() as EntityFactRow[];

    return rows.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      fact: row.fact,
      createdAt: row.created_at,
    }));
  }
}
