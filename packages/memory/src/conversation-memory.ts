import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChatMessage, ConversationMemory } from "@arcon/shared";

interface MessageRow {
  id: number;
  conversation_id: string;
  role: ChatMessage["role"];
  content: string;
  created_at: string;
}

export class SQLiteConversationMemory implements ConversationMemory {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
      ON messages (conversation_id, created_at);
    `);
  }

  async storeMessage(message: Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string }): Promise<ChatMessage> {
    const createdAt = message.createdAt ?? new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO messages (conversation_id, role, content, created_at)
         VALUES (@conversationId, @role, @content, @createdAt)`
      )
      .run({
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        createdAt
      });

    return {
      id: Number(result.lastInsertRowid),
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt
    };
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const rows = this.db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(conversationId, limit) as MessageRow[];

    return rows.reverse().map(toChatMessage);
  }

  async clearConversation(conversationId: string): Promise<void> {
    this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
  }

  close(): void {
    this.db.close();
  }
}

export function createConversationMemory(databasePath: string): ConversationMemory {
  return new SQLiteConversationMemory(databasePath);
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
}
