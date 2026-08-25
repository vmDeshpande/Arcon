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
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  SUPERSEDED = "SUPERSEDED"
}

export enum MemorySourceType {
  USER_EXPLICIT = "USER_EXPLICIT",
  USER_CONFIRMED = "USER_CONFIRMED",
  INFERRED = "INFERRED",
  SYSTEM_OBSERVED = "SYSTEM_OBSERVED"
}

export enum MemoryScope {
  USER = "USER",
  ARCON = "ARCON",
  PROJECT = "PROJECT",
  ENTITY = "ENTITY",
  CONVERSATION = "CONVERSATION"
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
  scope: MemoryScope;
}

export interface MemoryMutation {
  id: string;
  memoryId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  previousContent?: string;
  newContent?: string;
  reason?: string;
  source: string;
  createdAt: string;
}

export interface MemoryMutationFilter {
  memoryId?: string;
  action?: string;
  source?: string;
  limit?: number;
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
  scope?: MemoryScope;
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
  scope?: MemoryScope;
}

export interface ListMemoriesFilter {
  type?: MemoryType;
  status?: MemoryStatus;
  scope?: MemoryScope;
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
  scope: string;
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
        status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'ARCHIVED', 'OBSOLETE', 'CONTRADICTED', 'PENDING_CONFIRMATION', 'SUPERSEDED')),
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
        scope TEXT NOT NULL DEFAULT 'USER',
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

      CREATE INDEX IF NOT EXISTS idx_personal_memories_scope
      ON personal_memories (scope);

      CREATE TABLE IF NOT EXISTS emotions (
        name TEXT PRIMARY KEY,
        value REAL NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS interests (
        topic TEXT PRIMARY KEY,
        weight REAL NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interests_weight
      ON interests (weight DESC);

      CREATE TABLE IF NOT EXISTS memory_audit_log (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT,
        previous_content TEXT,
        new_content TEXT,
        reason TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_audit_log_memory_id
      ON memory_audit_log (memory_id);

      CREATE INDEX IF NOT EXISTS idx_memory_audit_log_action
      ON memory_audit_log (action);

      CREATE TABLE IF NOT EXISTS arcon_interests (
        topic TEXT PRIMARY KEY,
        weight REAL NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_arcon_interests_weight
      ON arcon_interests (weight DESC);
    `);

    this.migrateScopeColumn();

    const emotionCount = this.db
      .prepare("SELECT COUNT(*) as count FROM emotions")
      .get() as { count: number };

    if (emotionCount.count === 0) {
      const now = Date.now();
      const defaultEmotions = [
        "happiness",
        "frustration",
        "curiosity",
        "trust",
        "confidence",
      ];

      for (const name of defaultEmotions) {
        this.db
          .prepare(
            `INSERT INTO emotions (name, value, last_updated) VALUES (?, ?, ?)`,
          )
          .run(name, 0, now);
      }
    }
  }

  private migrateScopeColumn(): void {
    const columns = this.db
      .prepare("PRAGMA table_info(personal_memories)")
      .all() as Array<{ name: string }>;

    const hasScopeColumn = columns.some((column) => column.name === "scope");

    if (!hasScopeColumn) {
      this.db.exec("ALTER TABLE personal_memories ADD COLUMN scope TEXT NOT NULL DEFAULT 'USER'");
    }
  }

  markSuperseded(id: string): Memory | null {
    const existing = this.getMemoryById(id);
    const result = this.updateMemory(id, {
      status: MemoryStatus.SUPERSEDED,
    });

    if (result) {
      this.recordMutation({
        memoryId: id,
        action: "SUPERSEDE",
        previousStatus: existing?.status ?? MemoryStatus.ACTIVE,
        newStatus: MemoryStatus.SUPERSEDED,
        previousContent: existing?.content,
        newContent: result.content,
        source: "system",
      });
    }

    return result;
  }

  markContradicted(id: string): Memory | null {
    const result = this.updateMemory(id, {
      status: MemoryStatus.CONTRADICTED,
    });

    if (result) {
      this.recordMutation({
        memoryId: id,
        action: "CONTRADICT",
        previousStatus: MemoryStatus.ACTIVE,
        newStatus: MemoryStatus.CONTRADICTED,
        source: "system",
      });
    }

    return result;
  }

  confirmPendingMemory(id: string, content?: string, confidenceScore?: number): Memory | null {
    const existing = this.getMemoryById(id);
    if (!existing) {
      return null;
    }

    if (existing.status === MemoryStatus.ACTIVE) {
      return existing;
    }

    if (existing.status !== MemoryStatus.PENDING_CONFIRMATION) {
      return null;
    }

    const result = this.updateMemory(id, {
      status: MemoryStatus.ACTIVE,
      content: content ?? existing.content,
      confidenceScore: confidenceScore ?? existing.confidenceScore,
      sourceType: MemorySourceType.USER_CONFIRMED,
      evidenceCount: existing.evidenceCount + 1,
    });

    if (result) {
      this.recordMutation({
        memoryId: id,
        action: "CONFIRM",
        previousStatus: MemoryStatus.PENDING_CONFIRMATION,
        newStatus: MemoryStatus.ACTIVE,
        previousContent: existing.content,
        newContent: result.content,
        source: "user",
      });
    }

    return result;
  }

  rejectPendingMemory(id: string): Memory | null {
    const existing = this.getMemoryById(id);
    if (!existing) {
      return null;
    }

    if (existing.status !== MemoryStatus.PENDING_CONFIRMATION) {
      return null;
    }

    const result = this.updateMemory(id, {
      status: MemoryStatus.OBSOLETE,
    });

    if (result) {
      this.recordMutation({
        memoryId: id,
        action: "REJECT",
        previousStatus: MemoryStatus.PENDING_CONFIRMATION,
        newStatus: MemoryStatus.OBSOLETE,
        source: "user",
      });
    }

    return result;
  }

  resolveContradiction(id: string, keepActive: boolean): Memory | null {
    const existing = this.getMemoryById(id);
    if (!existing) {
      return null;
    }

    if (existing.status !== MemoryStatus.CONTRADICTED) {
      return null;
    }

    const newStatus = keepActive ? MemoryStatus.ACTIVE : MemoryStatus.OBSOLETE;
    const result = this.updateMemory(id, {
      status: newStatus,
    });

    if (result) {
      this.recordMutation({
        memoryId: id,
        action: "RESOLVE_CONTRADICTION",
        previousStatus: MemoryStatus.CONTRADICTED,
        newStatus,
        source: "user",
      });
    }

    return result;
  }

  recordMutation(mutation: Omit<MemoryMutation, "id" | "createdAt">): void {
    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    this.db
      .prepare(
        `INSERT INTO memory_audit_log (
          id, memory_id, action, previous_status, new_status,
          previous_content, new_content, reason, source, created_at
        ) VALUES (
          @id, @memoryId, @action, @previousStatus, @newStatus,
          @previousContent, @newContent, @reason, @source, @createdAt
        )`
      )
      .run({
        id,
        memoryId: mutation.memoryId,
        action: mutation.action,
        previousStatus: mutation.previousStatus ?? null,
        newStatus: mutation.newStatus ?? null,
        previousContent: mutation.previousContent ?? null,
        newContent: mutation.newContent ?? null,
        reason: mutation.reason ?? null,
        source: mutation.source,
        createdAt: now,
      });
  }

  getMutations(filter: MemoryMutationFilter = {}): MemoryMutation[] {
    let query = "SELECT * FROM memory_audit_log WHERE 1=1";
    const params: unknown[] = [];

    if (filter.memoryId) {
      query += " AND memory_id = ?";
      params.push(filter.memoryId);
    }

    if (filter.action) {
      query += " AND action = ?";
      params.push(filter.action);
    }

    if (filter.source) {
      query += " AND source = ?";
      params.push(filter.source);
    }

    query += " ORDER BY created_at DESC";

    if (filter.limit) {
      query += " LIMIT ?";
      params.push(filter.limit);
    }

    return (this.db.prepare(query).all(...params) as AuditLogRow[]).map(toMemoryMutation);
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
      supersedesId: normalizeOptionalString(input.supersedesId),
      scope: input.scope ?? MemoryScope.USER,
    };

    this.db
      .prepare(
        `INSERT INTO personal_memories (
          id, type, status, content, importance_score, confidence_score, source_type,
          created_at, updated_at, subject, tags, evidence_count, last_used_at, supersedes_id, scope
        ) VALUES (
          @id, @type, @status, @content, @importanceScore, @confidenceScore, @sourceType,
          @createdAt, @updatedAt, @subject, @tags, @evidenceCount, @lastUsedAt, @supersedesId, @scope
        )`
      )
      .run(toDatabaseParams(memory));

    this.recordMutation({
      memoryId: memory.id,
      action: "CREATE",
      newStatus: memory.status,
      newContent: memory.content,
      source: input.sourceType,
    });

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
      scope: input.scope ?? existing.scope,
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
             supersedes_id = @supersedesId,
             scope = @scope
         WHERE id = @id`
      )
      .run(toDatabaseParams(updated));

    const action = updated.status !== existing.status
      ? "STATUS_CHANGE"
      : updated.content !== existing.content
        ? "CONTENT_UPDATE"
        : "UPDATE";

    this.recordMutation({
      memoryId: id,
      action,
      previousStatus: existing.status,
      newStatus: updated.status,
      previousContent: existing.content,
      newContent: updated.content,
      source: updated.sourceType,
    });

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
    if (filter.type && filter.status && filter.scope) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE type = ? AND status = ? AND scope = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.type, filter.status, filter.scope) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.type && filter.status) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE type = ? AND status = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.type, filter.status) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.type && filter.scope) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE type = ? AND scope = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.type, filter.scope) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.type) {
      return (
        this.db.prepare("SELECT * FROM personal_memories WHERE type = ? ORDER BY updated_at DESC, created_at DESC").all(filter.type) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.status && filter.scope) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE status = ? AND scope = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.status, filter.scope) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.status) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE status = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.status) as MemoryRow[]
      ).map(toMemory);
    }

    if (filter.scope) {
      return (
        this.db
          .prepare("SELECT * FROM personal_memories WHERE scope = ? ORDER BY updated_at DESC, created_at DESC")
          .all(filter.scope) as MemoryRow[]
      ).map(toMemory);
    }

    return (this.db.prepare("SELECT * FROM personal_memories ORDER BY updated_at DESC, created_at DESC").all() as MemoryRow[]).map(toMemory);
  }

  getEmotion(name: string): { name: string; value: number; lastUpdated: number } | null {
    const row = this.db
      .prepare("SELECT name, value, last_updated FROM emotions WHERE name = ?")
      .get(name) as { name: string; value: number; last_updated: number } | undefined;

    return row
      ? { name: row.name, value: row.value, lastUpdated: row.last_updated }
      : null;
  }

  listEmotions(): Array<{ name: string; value: number; lastUpdated: number }> {
    return (
      this.db
        .prepare("SELECT name, value, last_updated FROM emotions ORDER BY name ASC")
        .all() as Array<{ name: string; value: number; last_updated: number }>
    ).map((row) => ({ name: row.name, value: row.value, lastUpdated: row.last_updated }));
  }

  saveEmotion(name: string, value: number, lastUpdated: number): void {
    this.db
      .prepare(
        `INSERT INTO emotions (name, value, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET value = excluded.value, last_updated = excluded.last_updated`,
      )
      .run(name, value, lastUpdated);
  }

  getInterest(topic: string): { topic: string; weight: number; lastUpdated: number } | null {
    const row = this.db
      .prepare("SELECT topic, weight, last_updated FROM interests WHERE topic = ?")
      .get(topic) as { topic: string; weight: number; last_updated: number } | undefined;

    return row
      ? { topic: row.topic, weight: row.weight, lastUpdated: row.last_updated }
      : null;
  }

  listInterests(): Array<{ topic: string; weight: number; lastUpdated: number }> {
    return (
      this.db
        .prepare("SELECT topic, weight, last_updated FROM interests ORDER BY weight DESC, topic ASC")
        .all() as Array<{ topic: string; weight: number; last_updated: number }>
    ).map((row) => ({ topic: row.topic, weight: row.weight, lastUpdated: row.last_updated }));
  }

  saveInterest(topic: string, weight: number, lastUpdated: number): void {
    this.db
      .prepare(
        `INSERT INTO interests (topic, weight, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(topic) DO UPDATE SET weight = excluded.weight, last_updated = excluded.last_updated`,
      )
      .run(topic, weight, lastUpdated);
  }

  deleteInterest(topic: string): boolean {
    const result = this.db.prepare("DELETE FROM interests WHERE topic = ?").run(topic);
    return result.changes > 0;
  }

  getArconInterest(topic: string): { topic: string; weight: number; lastUpdated: number } | null {
    const row = this.db
      .prepare("SELECT topic, weight, last_updated FROM arcon_interests WHERE topic = ?")
      .get(topic) as { topic: string; weight: number; last_updated: number } | undefined;

    return row
      ? { topic: row.topic, weight: row.weight, lastUpdated: row.last_updated }
      : null;
  }

  listArconInterests(): Array<{ topic: string; weight: number; lastUpdated: number }> {
    return (
      this.db
        .prepare("SELECT topic, weight, last_updated FROM arcon_interests ORDER BY weight DESC, topic ASC")
        .all() as Array<{ topic: string; weight: number; last_updated: number }>
    ).map((row) => ({ topic: row.topic, weight: row.weight, lastUpdated: row.last_updated }));
  }

  saveArconInterest(topic: string, weight: number, lastUpdated: number): void {
    this.db
      .prepare(
        `INSERT INTO arcon_interests (topic, weight, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(topic) DO UPDATE SET weight = excluded.weight, last_updated = excluded.last_updated`,
      )
      .run(topic, weight, lastUpdated);
  }

  deleteArconInterest(topic: string): boolean {
    const result = this.db.prepare("DELETE FROM arcon_interests WHERE topic = ?").run(topic);
    return result.changes > 0;
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
    supersedesId: input.supersedesId,
    scope: input.scope ?? MemoryScope.USER,
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
    supersedesId: memory.supersedesId ?? null,
    scope: memory.scope,
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
    supersedesId: row.supersedes_id ?? undefined,
    scope: row.scope as MemoryScope,
  };
}

interface AuditLogRow {
  id: string;
  memory_id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  previous_content: string | null;
  new_content: string | null;
  reason: string | null;
  source: string;
  created_at: string;
}

function toMemoryMutation(row: AuditLogRow): MemoryMutation {
  return {
    id: row.id,
    memoryId: row.memory_id,
    action: row.action,
    previousStatus: row.previous_status ?? undefined,
    newStatus: row.new_status ?? undefined,
    previousContent: row.previous_content ?? undefined,
    newContent: row.new_content ?? undefined,
    reason: row.reason ?? undefined,
    source: row.source,
    createdAt: row.created_at,
  };
}
