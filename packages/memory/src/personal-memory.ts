import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export enum MemoryType {
  FACT = "FACT",
  PREFERENCE = "PREFERENCE",
  PROJECT = "PROJECT",
  GOAL = "GOAL",
  RELATIONSHIP = "RELATIONSHIP",
  CONSTRAINT = "CONSTRAINT"
}

export enum MemoryStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  OBSOLETE = "OBSOLETE",
  CONTRADICTED = "CONTRADICTED",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
}

export enum MemorySourceType {
  USER_EXPLICIT = "USER_EXPLICIT",
  USER_CONFIRMED = "USER_CONFIRMED",
  INFERRED = "INFERRED",
  SYSTEM_OBSERVED = "SYSTEM_OBSERVED"
}

export interface Memory {
  id: string;
  type: MemoryType;
  status: MemoryStatus;
  content: string;
  importanceScore: number;
  confidenceScore: number;
  sourceType: MemorySourceType;
  createdAt: string;
  updatedAt: string;
  subject?: string;
  tags: string[];
  evidenceCount: number;
  lastUsedAt?: string;
  supersedesId?: string;
}

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  importanceScore: number;
  confidenceScore: number;
  sourceType: MemorySourceType;
  status?: MemoryStatus;
  subject?: string;
  tags?: string[];
  evidenceCount?: number;
  lastUsedAt?: string;
  supersedesId?: string;
}

export interface UpdateMemoryInput {
  type?: MemoryType;
  status?: MemoryStatus;
  content?: string;
  importanceScore?: number;
  confidenceScore?: number;
  sourceType?: MemorySourceType;
  subject?: string | null;
  tags?: string[];
  evidenceCount?: number;
  lastUsedAt?: string | null;
  supersedesId?: string | null;
}

export interface ListMemoriesFilter {
  type?: MemoryType;
  status?: MemoryStatus;
}

interface MemoryRow {
  id: string;
  type: string;
  status: string;
  content: string;
  importance_score: number;
  confidence_score: number;
  source_type: string;
  created_at: string;
  updated_at: string;
  subject: string | null;
  tags: string;
  evidence_count: number;
  last_used_at: string | null;
  supersedes_id: string | null;
}

export class MemoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryValidationError";
  }
}

export class MemoryRepository {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS personal_memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('FACT', 'PREFERENCE', 'PROJECT', 'GOAL', 'RELATIONSHIP', 'CONSTRAINT')),
        status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'ARCHIVED', 'OBSOLETE', 'CONTRADICTED', 'PENDING_CONFIRMATION')),
        content TEXT NOT NULL,
        importance_score INTEGER NOT NULL CHECK(importance_score >= 1 AND importance_score <= 10),
        confidence_score REAL NOT NULL CHECK(confidence_score >= 0 AND confidence_score <= 1),
        source_type TEXT NOT NULL CHECK(source_type IN ('USER_EXPLICIT', 'USER_CONFIRMED', 'INFERRED', 'SYSTEM_OBSERVED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        subject TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        evidence_count INTEGER NOT NULL DEFAULT 1 CHECK(evidence_count >= 0),
        last_used_at TEXT,
        supersedes_id TEXT,
        FOREIGN KEY (supersedes_id) REFERENCES personal_memories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_personal_memories_type
      ON personal_memories (type);

      CREATE INDEX IF NOT EXISTS idx_personal_memories_status
      ON personal_memories (status);

      CREATE INDEX IF NOT EXISTS idx_personal_memories_type_status
      ON personal_memories (type, status);

      CREATE INDEX IF NOT EXISTS idx_personal_memories_subject
      ON personal_memories (subject);

      CREATE INDEX IF NOT EXISTS idx_personal_memories_updated
      ON personal_memories (updated_at);
    `);
  }

  createMemory(input: CreateMemoryInput): Memory {
    validateCreateMemoryInput(input);

    const now = new Date().toISOString();
    const memory: Memory = {
      id: randomUUID(),
      type: input.type,
      status: input.status ?? MemoryStatus.ACTIVE,
      content: input.content.trim(),
      importanceScore: input.importanceScore,
      confidenceScore: input.confidenceScore,
      sourceType: input.sourceType,
      createdAt: now,
      updatedAt: now,
      subject: normalizeOptionalString(input.subject),
      tags: normalizeTags(input.tags),
      evidenceCount: input.evidenceCount ?? 1,
      lastUsedAt: normalizeOptionalString(input.lastUsedAt),
      supersedesId: normalizeOptionalString(input.supersedesId)
    };

    this.db
      .prepare(
        `INSERT INTO personal_memories (
          id, type, status, content, importance_score, confidence_score, source_type,
          created_at, updated_at, subject, tags, evidence_count, last_used_at, supersedes_id
        ) VALUES (
          @id, @type, @status, @content, @importanceScore, @confidenceScore, @sourceType,
          @createdAt, @updatedAt, @subject, @tags, @evidenceCount, @lastUsedAt, @supersedesId
        )`
      )
      .run(toDatabaseParams(memory));

    return memory;
  }

  getMemoryById(id: string): Memory | null {
    const row = this.db.prepare("SELECT * FROM personal_memories WHERE id = ?").get(id) as MemoryRow | undefined;
    return row ? toMemory(row) : null;
  }

  updateMemory(id: string, input: UpdateMemoryInput): Memory | null {
    const existing = this.getMemoryById(id);
    if (!existing) {
      return null;
    }

    const updated: Memory = {
      ...existing,
      type: input.type ?? existing.type,
      status: input.status ?? existing.status,
      content: input.content === undefined ? existing.content : input.content.trim(),
      importanceScore: input.importanceScore ?? existing.importanceScore,
      confidenceScore: input.confidenceScore ?? existing.confidenceScore,
      sourceType: input.sourceType ?? existing.sourceType,
      subject: input.subject === undefined ? existing.subject : normalizeOptionalString(input.subject),
      tags: input.tags === undefined ? existing.tags : normalizeTags(input.tags),
      evidenceCount: input.evidenceCount ?? existing.evidenceCount,
      lastUsedAt: input.lastUsedAt === undefined ? existing.lastUsedAt : normalizeOptionalString(input.lastUsedAt),
      supersedesId: input.supersedesId === undefined ? existing.supersedesId : normalizeOptionalString(input.supersedesId),
      updatedAt: new Date().toISOString()
    };

    validateMemory(updated);

    this.db
      .prepare(
        `UPDATE personal_memories
         SET type = @type,
             status = @status,
             content = @content,
             importance_score = @importanceScore,
             confidence_score = @confidenceScore,
             source_type = @sourceType,
             updated_at = @updatedAt,
             subject = @subject,
             tags = @tags,
             evidence_count = @evidenceCount,
             last_used_at = @lastUsedAt,
             supersedes_id = @supersedesId
         WHERE id = @id`
      )
      .run(toDatabaseParams(updated));

    return updated;
  }

  archiveMemory(id: string): Memory | null {
    return this.updateMemory(id, { status: MemoryStatus.ARCHIVED });
  }

  deleteMemory(id: string): boolean {
    const result = this.db.prepare("DELETE FROM personal_memories WHERE id = ?").run(id);
    return result.changes > 0;
  }

  listMemories(filter: ListMemoriesFilter = {}): Memory[] {
    if (filter.type && filter.status) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE type = ? AND status = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.type, filter.status) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.type) {
      return (
        this.db.prepare("SELECT * FROM personal_memories WHERE type = ? ORDER BY updated_at DESC, created_at DESC").all(filter.type) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.status) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE status = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.status) as MemoryRow[]
      ).map(toMemory);
    }

    return (this.db.prepare("SELECT * FROM personal_memories ORDER BY updated_at DESC, created_at DESC").all() as MemoryRow[]).map(toMemory);
  }

  close(): void {
    this.db.close();
  }
}

export function createMemoryRepository(databasePath: string): MemoryRepository {
  return new MemoryRepository(databasePath);
}

function validateCreateMemoryInput(input: CreateMemoryInput): void {
  validateMemory({
    id: "validation",
    type: input.type,
    status: input.status ?? MemoryStatus.ACTIVE,
    content: input.content,
    importanceScore: input.importanceScore,
    confidenceScore: input.confidenceScore,
    sourceType: input.sourceType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subject: input.subject,
    tags: normalizeTags(input.tags),
    evidenceCount: input.evidenceCount ?? 1,
    lastUsedAt: input.lastUsedAt,
    supersedesId: input.supersedesId
  });
}

function validateMemory(memory: Memory): void {
  if (!Object.values(MemoryType).includes(memory.type)) {
    throw new MemoryValidationError("memory type is invalid");
  }

  if (!Object.values(MemoryStatus).includes(memory.status)) {
    throw new MemoryValidationError("memory status is invalid");
  }

  if (!Object.values(MemorySourceType).includes(memory.sourceType)) {
    throw new MemoryValidationError("memory source type is invalid");
  }

  if (!memory.content.trim()) {
    throw new MemoryValidationError("memory content cannot be empty");
  }

  if (!Number.isInteger(memory.importanceScore) || memory.importanceScore < 1 || memory.importanceScore > 10) {
    throw new MemoryValidationError("importanceScore must be an integer between 1 and 10");
  }

  if (!Number.isFinite(memory.confidenceScore) || memory.confidenceScore < 0 || memory.confidenceScore > 1) {
    throw new MemoryValidationError("confidenceScore must be between 0 and 1");
  }

  if (!Number.isInteger(memory.evidenceCount) || memory.evidenceCount < 0) {
    throw new MemoryValidationError("evidenceCount must be a non-negative integer");
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) {
    return [];
  }

  const normalized = tags.map((tag) => tag.trim()).filter(Boolean);
  return [...new Set(normalized)];
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function toDatabaseParams(memory: Memory) {
  return {
    ...memory,
    tags: JSON.stringify(memory.tags),
    subject: memory.subject ?? null,
    lastUsedAt: memory.lastUsedAt ?? null,
    supersedesId: memory.supersedesId ?? null
  };
}

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    type: row.type as MemoryType,
    status: row.status as MemoryStatus,
    content: row.content,
    importanceScore: row.importance_score,
    confidenceScore: row.confidence_score,
    sourceType: row.source_type as MemorySourceType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subject: row.subject ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    evidenceCount: row.evidence_count,
    lastUsedAt: row.last_used_at ?? undefined,
    supersedesId: row.supersedes_id ?? undefined
  };
}
