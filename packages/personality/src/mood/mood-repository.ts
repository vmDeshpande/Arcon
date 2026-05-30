import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  MoodState,
  createDefaultMood,
} from "./mood.js";

interface MoodRow {
  curiosity: number;
  frustration: number;
  trust: number;
  excitement: number;
  updated_at: string;
}

export class MoodRepository {
  private readonly db: Database.Database;

  constructor(
    databasePath: string,
  ) {
    mkdirSync(
      dirname(databasePath),
      { recursive: true },
    );

    this.db =
      new Database(databasePath);

    this.db.pragma(
      "journal_mode = WAL",
    );

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mood_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),

        curiosity REAL NOT NULL,
        frustration REAL NOT NULL,
        trust REAL NOT NULL,
        excitement REAL NOT NULL,

        updated_at TEXT NOT NULL
      );
    `);

    const existing =
      this.db
        .prepare(
          "SELECT COUNT(*) as count FROM mood_state",
        )
        .get() as {
        count: number;
      };

    if (existing.count === 0) {
      const mood =
        createDefaultMood();

      this.db
        .prepare(`
          INSERT INTO mood_state (
            id,
            curiosity,
            frustration,
            trust,
            excitement,
            updated_at
          )
          VALUES (
            1,
            @curiosity,
            @frustration,
            @trust,
            @excitement,
            @updatedAt
          )
        `)
        .run(mood);
    }
  }

  getMood(): MoodState {
    const row =
      this.db
        .prepare(
          `
          SELECT *
          FROM mood_state
          WHERE id = 1
        `,
        )
        .get() as MoodRow;

    return {
      curiosity:
        row.curiosity,
      frustration:
        row.frustration,
      trust:
        row.trust,
      excitement:
        row.excitement,
      updatedAt:
        row.updated_at,
    };
  }

  saveMood(
    mood: MoodState,
  ): void {
    this.db
      .prepare(`
        UPDATE mood_state
        SET curiosity = ?,
            frustration = ?,
            trust = ?,
            excitement = ?,
            updated_at = ?
        WHERE id = 1
      `)
      .run(
        mood.curiosity,
        mood.frustration,
        mood.trust,
        mood.excitement,
        mood.updatedAt,
      );
  }

  reset(): void {
    const mood =
      createDefaultMood();

    this.saveMood(mood);
  }

  close(): void {
    this.db.close();
  }
}