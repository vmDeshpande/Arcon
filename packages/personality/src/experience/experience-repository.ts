import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { Experience } from "./experience.js";

interface ExperienceRow {
  id: string;
  type: string;
  count: number;
  first_seen: string;
  last_seen: string;
  context?: string;
}

export class ExperienceRepository {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), {
      recursive: true,
    });

    this.db = new Database(databasePath);

    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS experiences (
        id TEXT PRIMARY KEY,
        type TEXT UNIQUE NOT NULL,
        count INTEGER NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        context TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_experiences_type
      ON experiences(type);
    `);

    try {
      this.db.exec(`ALTER TABLE experiences ADD COLUMN context TEXT`);
    } catch {
      // Column already exists
    }
  }

  createExperience(type: string, context?: string): Experience {
    const now = new Date().toISOString();

    const experience: Experience = {
      id: randomUUID(),
      type,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      context,
    };

    this.db
      .prepare(
        `
        INSERT INTO experiences (
          id,
          type,
          count,
          first_seen,
          last_seen,
          context
        )
        VALUES (
          @id,
          @type,
          @count,
          @firstSeen,
          @lastSeen,
          @context
        )
      `,
      )
      .run(experience);

    return experience;
  }

  getExperience(type: string): Experience | null {
    const row = this.db
      .prepare("SELECT * FROM experiences WHERE type = ?")
      .get(type) as ExperienceRow | undefined;

    return row ? toExperience(row) : null;
  }

  incrementExperience(type: string, context?: string): Experience {
    const existing = this.getExperience(type);

    if (!existing) {
      return this.createExperience(type, context);
    }

    const updated: Experience = {
      ...existing,
      count: existing.count + 1,
      lastSeen: new Date().toISOString(),
      context: context ?? existing.context,
    };

    this.db
      .prepare(
        `
        UPDATE experiences
        SET count = ?,
            last_seen = ?,
            context = ?
        WHERE type = ?
      `,
      )
      .run(updated.count, updated.lastSeen, updated.context, type);

    return updated;
  }

  listExperiences(): Experience[] {
    return (
      this.db
        .prepare(
          `
          SELECT *
          FROM experiences
          ORDER BY count DESC
        `,
        )
        .all() as ExperienceRow[]
    ).map(toExperience);
  }

  close(): void {
    this.db.close();
  }
}

function toExperience(row: ExperienceRow): Experience {
  return {
    id: row.id,
    type: row.type,
    count: row.count,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    context: row.context,
  };
}
