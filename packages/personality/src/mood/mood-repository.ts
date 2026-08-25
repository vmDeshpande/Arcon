import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  MoodState,
  MoodCategory,
  createDefaultMood,
} from "./mood.js";

interface MoodRow {
  category: string;
  intensity: number;
  curiosity: number;
  frustration: number;
  ask_count?: number;
  pending_question?: number;
  trust: number;
  excitement: number;
  cause?: string;
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

        category TEXT NOT NULL DEFAULT 'NEUTRAL',
        intensity REAL NOT NULL DEFAULT 0.5,
        curiosity REAL NOT NULL,
        frustration REAL NOT NULL,
        ask_count INTEGER NOT NULL DEFAULT 0,
        pending_question INTEGER NOT NULL DEFAULT 0,
        trust REAL NOT NULL,
        excitement REAL NOT NULL,
        cause TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    this.ensureColumn(
      "ask_count",
      "INTEGER NOT NULL DEFAULT 0",
    );

    this.ensureColumn(
      "pending_question",
      "INTEGER NOT NULL DEFAULT 0",
    );

    this.ensureColumn(
      "category",
      "TEXT NOT NULL DEFAULT 'NEUTRAL'",
    );

    this.ensureColumn(
      "intensity",
      "REAL NOT NULL DEFAULT 0.5",
    );

    this.ensureColumn(
      "cause",
      "TEXT",
    );

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
            category,
            intensity,
            curiosity,
            frustration,
            ask_count,
            pending_question,
            trust,
            excitement,
            cause,
            updated_at
          )
          VALUES (
            1,
            @category,
            @intensity,
            @curiosity,
            @frustration,
            @askCount,
            @pendingQuestion,
            @trust,
            @excitement,
            @cause,
            @updatedAt
          )
        `)
        .run({
          category: mood.category,
          intensity: mood.intensity,
          curiosity: mood.curiosity,
          frustration: mood.frustration,
          askCount: mood.askCount,
          pendingQuestion: mood.pendingQuestion ? 1 : 0,
          trust: mood.trust,
          excitement: mood.excitement,
          cause: mood.cause ?? null,
          updatedAt: mood.updatedAt,
        });
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
      category: row.category as MoodCategory,
      intensity: row.intensity,
      curiosity: row.curiosity,
      frustration: row.frustration,
      askCount: row.ask_count ?? 0,
      pendingQuestion: Boolean(row.pending_question ?? 0),
      trust: row.trust,
      excitement: row.excitement,
      cause: row.cause ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  saveMood(
    mood: MoodState,
  ): void {
    this.db
      .prepare(`
        UPDATE mood_state
        SET category = ?,
            intensity = ?,
            curiosity = ?,
            frustration = ?,
            ask_count = ?,
            pending_question = ?,
            trust = ?,
            excitement = ?,
            cause = ?,
            updated_at = ?
        WHERE id = 1
      `)
      .run(
        mood.category,
        mood.intensity,
        mood.curiosity,
        mood.frustration,
        mood.askCount,
        mood.pendingQuestion ? 1 : 0,
        mood.trust,
        mood.excitement,
        mood.cause ?? null,
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

  private ensureColumn(
    name: string,
    definition: string,
  ): void {
    const columns = this.db
      .prepare("PRAGMA table_info(mood_state)")
      .all() as Array<{ name: string }>;

    if (columns.some((column) => column.name === name)) {
      return;
    }

    this.db.exec(
      `ALTER TABLE mood_state ADD COLUMN ${name} ${definition}`,
    );
  }
}
