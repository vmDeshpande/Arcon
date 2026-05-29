export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id?: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
}

export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface ConversationMemory {
  storeMessage(message: Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string }): Promise<ChatMessage>;
  getRecentMessages(conversationId: string, limit: number): Promise<ChatMessage[]>;
  clearConversation(conversationId: string): Promise<void>;
}

export interface AiClient {
  generateReply(messages: ChatMessage[]): Promise<string>;
}

export const ArconEventType = {
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  MESSAGE_STORED: "MESSAGE_STORED",
  AI_RESPONSE_GENERATED: "AI_RESPONSE_GENERATED",
  ERROR_OCCURRED: "ERROR_OCCURRED"
} as const;

export type ArconEventType = (typeof ArconEventType)[keyof typeof ArconEventType];

export type ArconEventPayloads = {
  [ArconEventType.MESSAGE_RECEIVED]: {
    conversationId: string;
    message: string;
  };
  [ArconEventType.MESSAGE_STORED]: {
    message: ChatMessage;
  };
  [ArconEventType.AI_RESPONSE_GENERATED]: {
    conversationId: string;
    reply: string;
  };
  [ArconEventType.ERROR_OCCURRED]: {
    error: Error;
    context?: string;
  };
};

export type EventHandler<T extends ArconEventType> = (payload: ArconEventPayloads[T]) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<ArconEventType, Set<EventHandler<ArconEventType>>>();

  on<T extends ArconEventType>(eventType: T, handler: EventHandler<T>): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler<ArconEventType>>();
    handlers.add(handler as EventHandler<ArconEventType>);
    this.handlers.set(eventType, handlers);

    return () => {
      handlers.delete(handler as EventHandler<ArconEventType>);
    };
  }

  async emit<T extends ArconEventType>(eventType: T, payload: ArconEventPayloads[T]): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    await Promise.all([...handlers].map((handler) => handler(payload as ArconEventPayloads[ArconEventType])));
  }
}
