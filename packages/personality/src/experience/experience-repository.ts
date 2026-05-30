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
        last_seen TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_experiences_type
      ON experiences(type);
    `);
  }

  createExperience(type: string): Experience {
    const now = new Date().toISOString();

    const experience: Experience = {
      id: randomUUID(),
      type,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    };

    this.db
      .prepare(
        `
        INSERT INTO experiences (
          id,
          type,
          count,
          first_seen,
          last_seen
        )
        VALUES (
          @id,
          @type,
          @count,
          @firstSeen,
          @lastSeen
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

  incrementExperience(type: string): Experience {
    const existing = this.getExperience(type);

    if (!existing) {
      return this.createExperience(type);
    }

    const updated: Experience = {
      ...existing,
      count: existing.count + 1,
      lastSeen: new Date().toISOString(),
    };

    this.db
      .prepare(
        `
        UPDATE experiences
        SET count = ?,
            last_seen = ?
        WHERE type = ?
      `,
      )
      .run(updated.count, updated.lastSeen, type);

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
  };
}
