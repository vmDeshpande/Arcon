import { ArconEventType, type EventBus, type Logger } from "@arcon/shared";

export function registerEventLogging(eventBus: EventBus, logger: Logger): void {
  eventBus.on(ArconEventType.MESSAGE_RECEIVED, ({ conversationId }) => {
    logger.info("Message received", { conversationId });
  });

  eventBus.on(ArconEventType.MESSAGE_STORED, ({ message }) => {
    logger.info("Message stored", {
      conversationId: message.conversationId,
      messageId: message.id,
      role: message.role
    });
  });

  eventBus.on(ArconEventType.AI_RESPONSE_GENERATED, ({ conversationId }) => {
    logger.info("AI response generated", { conversationId });
  });

  eventBus.on(ArconEventType.ERROR_OCCURRED, ({ error, context }) => {
    logger.error("Error occurred", {
      context,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  });
}
