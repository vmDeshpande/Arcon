export interface PromptBuildInput {
  systemPrompt: string;
  memoryContext: string;
  conversationHistory: string[];
  userMessage: string;
  strategy?: {
    responseStrategy: string;
    reason: string;
    tone: string;
  };
  relevantConversations?: Array<{
    conversationId: string;
    messages: { role: string; content: string }[];
  }>;
}

export class PromptBuilder {
  build(input: PromptBuildInput): string {
    const sections = [
      "SYSTEM:",
      input.systemPrompt,

      "",
    ];

    if (input.strategy) {
      sections.push(
        "RESPONSE STRATEGY:",
        `Approach: ${input.strategy.responseStrategy}`,
        `Reason: ${input.strategy.reason}`,
        `Tone: ${input.strategy.tone}`,
        "",
      );
    }

    sections.push(
      "MEMORIES:",
      input.memoryContext || "No relevant memories.",

      "",
    );

    if (input.relevantConversations && input.relevantConversations.length > 0) {
      sections.push("RELEVANT PAST CONVERSATIONS:");

      for (const conv of input.relevantConversations) {
        sections.push(`Conversation ${conv.conversationId}:`);

        for (const msg of conv.messages) {
          const role = msg.role === "user" ? "User" : "Arcon";
          sections.push(`${role}: ${msg.content}`);
        }

        sections.push("");
      }
    }

    if (input.conversationHistory.length > 0) {
      sections.push(
        "CONVERSATION:",
        ...input.conversationHistory,
        "",
      );
    } else {
      sections.push(
        "CONVERSATION:",
        "No previous conversation.",
        "",
      );
    }

    sections.push(
      "USER:",
      input.userMessage,
    );

    return sections.join("\n");
  }
}