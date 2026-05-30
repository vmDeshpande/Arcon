import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { Entity, EntityType } from "./entity.js";

interface EntityRow {
  id: string;
  name: string;
  type: EntityType;
  aliases: string;
  created_at: string;
  updated_at: string;
}

export interface EntityLinkRow {
  id: string;

  source_entity_id: string;

  relation: string;

  target_entity_id: string;

  created_at: string;
}

export class EntityRepository {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), {
      recursive: true,
    });

    this.db = new Database(databasePath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        aliases TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_links (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_name
      ON entities(name);

      CREATE INDEX IF NOT EXISTS idx_links_source
      ON entity_links(source_entity_id);

      CREATE INDEX IF NOT EXISTS idx_links_target
      ON entity_links(target_entity_id);
    `);
  }

  createEntity(name: string, type: EntityType): Entity {
    const now = new Date().toISOString();

    const entity: Entity = {
      id: randomUUID(),
      name,
      type,
      aliases: [],
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `
        INSERT INTO entities (
          id,
          name,
          type,
          aliases,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @name,
          @type,
          @aliases,
          @createdAt,
          @updatedAt
        )
      `,
      )
      .run({
        ...entity,
        aliases: JSON.stringify(entity.aliases),
      });

    return entity;
  }

  ensureEntity(name: string, type: EntityType): Entity {
    const existing = this.findByName(name);

    if (!existing) {
      return this.createEntity(name, type);
    }

    if (existing.type === "UNKNOWN" && type !== "UNKNOWN") {
      return this.updateEntityType(existing.id, type);
    }

    return existing;
  }

  getEntityByName(name: string): Entity | null {
    return this.findByName(name);
  }

  updateEntityType(id: string, type: EntityType): Entity {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          UPDATE entities
          SET type = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(type, now, id);

    const entity = this.findEntityById(id);

    if (!entity) {
      throw new Error(`Entity not found after type update: ${id}`);
    }

    return entity;
  }

  findByName(name: string): Entity | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM entities
          WHERE lower(name) = lower(?)
        `,
      )
      .get(name) as EntityRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      aliases: JSON.parse(row.aliases),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findEntityById(id: string): Entity | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM entities
          WHERE id = ?
        `,
      )
      .get(id) as EntityRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      aliases: JSON.parse(row.aliases),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listEntities(): Entity[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM entities
          ORDER BY name
        `,
      )
      .all() as EntityRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      aliases: JSON.parse(row.aliases),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  findLink(
    sourceEntityId: string,
    relation: string,
    targetEntityId: string,
  ): EntityLinkRow | undefined {
    return this.db
      .prepare(
        `
        SELECT *
        FROM entity_links
        WHERE source_entity_id = ?
        AND relation = ?
        AND target_entity_id = ?
      `,
      )
      .get(sourceEntityId, relation, targetEntityId) as
      | EntityLinkRow
      | undefined;
  }

  createLink(
    sourceEntityId: string,
    relation: string,
    targetEntityId: string,
  ): void {
    const existing = this.findLink(sourceEntityId, relation, targetEntityId);

    if (existing) {
      return;
    }

    this.db
      .prepare(
        `
        INSERT INTO entity_links (
          id,
          source_entity_id,
          relation,
          target_entity_id,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      )
      .run(
        randomUUID(),
        sourceEntityId,
        relation,
        targetEntityId,
        new Date().toISOString(),
      );
  }

  listLinks(): EntityLinkRow[] {
    return this.db
      .prepare(
        `
        SELECT *
        FROM entity_links
      `,
      )
      .all() as EntityLinkRow[];
  }

  getEntityRelationships(entityId: string): EntityLinkRow[] {
    return this.db
      .prepare(
        `
        SELECT *
        FROM entity_links
        WHERE source_entity_id = ?
        OR target_entity_id = ?
      `,
      )
      .all(entityId, entityId) as EntityLinkRow[];
  }

  getRelatedEntities(entityId: string): Entity[] {
    const links = this.getEntityRelationships(entityId);
    const relatedIds = Array.from(
      new Set(
        links.map((link) =>
          link.source_entity_id === entityId
            ? link.target_entity_id
            : link.source_entity_id,
        ),
      ),
    );

    return relatedIds.flatMap((id) => {
      const entity = this.findEntityById(id);
      return entity ? [entity] : [];
    });
  }

  resolveRelationship(
    sourceEntityId: string,
    relation: string,
  ): Entity | null {
    const link = this.db
      .prepare(
        `
        SELECT *
        FROM entity_links
        WHERE source_entity_id = ?
        AND relation = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      )
      .get(sourceEntityId, relation) as EntityLinkRow | undefined;

    if (!link) {
      return null;
    }

    return this.findEntityById(link.target_entity_id);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
