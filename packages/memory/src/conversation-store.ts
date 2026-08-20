import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  topics: string[];
  summary?: string;
  metadata: Record<string, unknown>;
}

export interface ConversationMessage {
  id: number;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface CreateConversationInput {
  id?: string;
  topics?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface StoreMessageInput {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export class ConversationStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        topics TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
      ON messages (conversation_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_messages_content
      ON messages (content);

      CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations (updated_at DESC);
    `);
  }

  createConversation(input: CreateConversationInput = {}): Conversation {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO conversations (id, created_at, updated_at, message_count, topics, summary, metadata)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(
      id,
      now,
      now,
      (input.topics ?? []).join(","),
      input.summary ?? "",
      JSON.stringify(input.metadata ?? {}),
    );

    return {
      id,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      topics: input.topics ?? [],
      summary: input.summary,
      metadata: input.metadata ?? {},
    };
  }

  getConversation(id: string): Conversation | null {
    const row = this.db.prepare(`
      SELECT id, created_at, updated_at, message_count, topics, summary, metadata
      FROM conversations WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      messageCount: row.message_count as number,
      topics: row.topics ? String(row.topics).split(",").filter(Boolean) : [],
      summary: row.summary as string,
      metadata: JSON.parse(row.metadata as string),
    };
  }

  listConversations(limit = 50, offset = 0): Conversation[] {
    const rows = this.db.prepare(`
      SELECT id, created_at, updated_at, message_count, topics, summary, metadata
      FROM conversations
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      messageCount: row.message_count as number,
      topics: row.topics ? String(row.topics).split(",").filter(Boolean) : [],
      summary: row.summary as string,
      metadata: JSON.parse(row.metadata as string),
    }));
  }

  storeMessage(input: StoreMessageInput): ConversationMessage {
    const createdAt = input.createdAt ?? new Date().toISOString();

    const result = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      input.conversationId,
      input.role,
      input.content,
      createdAt,
      JSON.stringify(input.metadata ?? {}),
    );

    this.db.prepare(`
      UPDATE conversations
      SET updated_at = ?, message_count = message_count + 1
      WHERE id = ?
    `).run(createdAt, input.conversationId);

    return {
      id: Number(result.lastInsertRowid),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      createdAt,
    };
  }

  getMessages(conversationId: string, limit = 100, offset = 0): ConversationMessage[] {
    const rows = this.db.prepare(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT ? OFFSET ?
    `).all(conversationId, limit, offset) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  getRecentMessages(conversationId: string, limit: number): ConversationMessage[] {
    const rows = this.db.prepare(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(conversationId, limit) as MessageRow[];

    return rows.reverse().map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  searchMessages(query: string, limit = 20): Array<{ conversation: Conversation; message: ConversationMessage; score: number }> {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    const rows = this.db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.content, m.created_at,
             c.id as conv_id, c.created_at as conv_created, c.updated_at as conv_updated,
             c.message_count, c.topics, c.summary, c.metadata
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(`%${lowerQuery}%`, limit * 2) as Record<string, unknown>[];

    const results: Array<{ conversation: Conversation; message: ConversationMessage; score: number }> = [];

    for (const row of rows) {
      const content = String(row.content).toLowerCase();
      let score = 0;

      if (content.includes(lowerQuery)) {
        score += 10;
      }

      for (const word of words) {
        if (content.includes(word)) {
          score += 1;
        }
      }

      const conversation: Conversation = {
        id: row.conv_id as string,
        createdAt: row.conv_created as string,
        updatedAt: row.conv_updated as string,
        messageCount: row.message_count as number,
        topics: row.topics ? String(row.topics).split(",").filter(Boolean) : [],
        summary: row.summary as string,
        metadata: JSON.parse(row.metadata as string),
      };

      const message: ConversationMessage = {
        id: row.id as number,
        conversationId: row.conversation_id as string,
        role: row.role as "user" | "assistant" | "system",
        content: row.content as string,
        createdAt: row.created_at as string,
      };

      results.push({ conversation, message, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  searchConversations(query: string, limit = 10): Conversation[] {
    const messages = this.searchMessages(query, limit);
    const seen = new Set<string>();
    const results: Conversation[] = [];

    for (const { conversation } of messages) {
      if (!seen.has(conversation.id)) {
        seen.add(conversation.id);
        results.push(conversation);
      }
    }

    return results;
  }

  getRelevantConversationHistory(query: string, limit = 3): Array<{ conversation: Conversation; messages: ConversationMessage[] }> {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    const rows = this.db.prepare(`
      SELECT c.id as conv_id, c.created_at as conv_created, c.updated_at as conv_updated,
             c.message_count, c.topics, c.summary, c.metadata,
             m.id, m.conversation_id, m.role, m.content, m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content LIKE ?
      ORDER BY c.updated_at DESC
      LIMIT ?
    `).all(`%${lowerQuery}%`, limit * 10) as Record<string, unknown>[];

    const conversationMap = new Map<string, { conversation: Conversation; messages: ConversationMessage[]; score: number }>();

    for (const row of rows) {
      const convId = row.conv_id as string;
      const content = String(row.content).toLowerCase();
      let score = 0;

      if (content.includes(lowerQuery)) score += 5;
      for (const word of words) {
        if (content.includes(word)) score += 1;
      }

      if (!conversationMap.has(convId)) {
        const conversation: Conversation = {
          id: convId,
          createdAt: row.conv_created as string,
          updatedAt: row.conv_updated as string,
          messageCount: row.message_count as number,
          topics: row.topics ? String(row.topics).split(",").filter(Boolean) : [],
          summary: row.summary as string,
          metadata: JSON.parse(row.metadata as string),
        };

        conversationMap.set(convId, {
          conversation,
          messages: [],
          score: 0,
        });
      }

      const entry = conversationMap.get(convId)!;
      entry.score = Math.max(entry.score, score);

      entry.messages.push({
        id: row.id as number,
        conversationId: row.conversation_id as string,
        role: row.role as "user" | "assistant" | "system",
        content: row.content as string,
        createdAt: row.created_at as string,
      });
    }

    const sorted = [...conversationMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    for (const entry of sorted) {
      entry.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    return sorted;
  }

  updateConversationSummary(id: string, summary: string, topics?: string[]): void {
    const existing = this.getConversation(id);
    if (!existing) return;

    const newTopics = topics ?? existing.topics;

    this.db.prepare(`
      UPDATE conversations
      SET summary = ?, topics = ?, updated_at = ?
      WHERE id = ?
    `).run(summary, newTopics.join(","), new Date().toISOString(), id);
  }

  clearConversation(conversationId: string): void {
    this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  }

  close(): void {
    this.db.close();
  }
}

interface MessageRow {
  id: number;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}
