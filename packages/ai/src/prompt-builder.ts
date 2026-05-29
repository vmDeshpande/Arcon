export interface PromptBuildInput {
  systemPrompt: string;
  memoryContext: string;
  conversationHistory: string[];
  userMessage: string;
}

export class PromptBuilder {
  build(input: PromptBuildInput): string {
    return [
      "SYSTEM:",
      input.systemPrompt,
      "",
      "MEMORIES:",
      input.memoryContext || "No relevant memories.",
      "",
      "CONVERSATION:",
      input.conversationHistory.length > 0
        ? input.conversationHistory.join("\n")
        : "No previous conversation.",
      "",
      "USER:",
      input.userMessage
    ].join("\n");
  }
}