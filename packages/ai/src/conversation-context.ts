import type { ChatMessage } from "@arcon/shared";

const DEFAULT_HISTORY_LIMIT = 20;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export class ConversationContext {
  private readonly histories: Map<string, ConversationTurn[]> = new Map();
  private readonly limit: number;

  constructor(limit = DEFAULT_HISTORY_LIMIT) {
    this.limit = limit;
  }

  getHistory(conversationId: string): ConversationTurn[] {
    return this.histories.get(conversationId) ?? [];
  }

  addTurn(conversationId: string, turn: ConversationTurn): void {
    const history = this.histories.get(conversationId) ?? [];
    history.push(turn);

    while (history.length > this.limit) {
      history.shift();
    }

    this.histories.set(conversationId, history);
  }

  addUserMessage(conversationId: string, content: string): void {
    this.addTurn(conversationId, {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  addAssistantMessage(conversationId: string, content: string): void {
    this.addTurn(conversationId, {
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  clear(conversationId: string): void {
    this.histories.delete(conversationId);
  }

  toPromptLines(conversationId: string): string[] {
    const history = this.getHistory(conversationId);

    if (history.length === 0) {
      return [];
    }

    return history.map((turn) => {
      const role = turn.role === "user" ? "User" : "Arcon";
      return `${role}: ${turn.content}`;
    });
  }
}
