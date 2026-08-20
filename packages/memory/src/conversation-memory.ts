import type { ChatMessage, ConversationMemory } from "@arcon/shared";
import { ConversationStore } from "./conversation-store.js";

export class SQLiteConversationMemory implements ConversationMemory {
  private readonly store: ConversationStore;

  constructor(databasePath: string) {
    this.store = new ConversationStore(databasePath);
  }

  async storeMessage(message: Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string }): Promise<ChatMessage> {
    const createdAt = message.createdAt ?? new Date().toISOString();
    const stored = this.store.storeMessage({
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt,
    });

    return {
      id: stored.id,
      conversationId: stored.conversationId,
      role: stored.role,
      content: stored.content,
      createdAt: stored.createdAt,
    };
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const messages = this.store.getRecentMessages(conversationId, limit);

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  async clearConversation(conversationId: string): Promise<void> {
    this.store.clearConversation(conversationId);
  }

  close(): void {
    this.store.close();
  }
}

export function createConversationMemory(databasePath: string): ConversationMemory {
  return new SQLiteConversationMemory(databasePath);
}
