import type { ContextSelection, ContextSnapshot } from "./cognitive/context-selection.js";
import type { CognitiveDecision } from "./cognitive-adapter.js";

export interface PromptBuildInput {
  systemPrompt: string;
  userMessage: string;
  context: ContextSelection;
  snapshot?: ContextSnapshot;
  cognitiveDecision?: CognitiveDecision;
  conversationHistory: string[];
  strategy?: {
    responseStrategy: string;
    reason: string;
    tone: string;
  };
}

export class PromptBuilder {
  build(input: PromptBuildInput): string {
    const sections: string[] = [
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

    if (input.cognitiveDecision?.clarificationNeeded) {
      sections.push("CLARIFICATION REQUIRED:");
      sections.push("The request is ambiguous or lacks sufficient context. Ask a concise clarifying question.");
      sections.push("");
    }

    if (input.cognitiveDecision?.unresolvedConflicts.length) {
      sections.push("UNRESOLVED CONFLICTS:");
      for (const conflict of input.cognitiveDecision.unresolvedConflicts) {
        sections.push(`[${conflict.status}] ${conflict.content}`);
      }
      sections.push("Acknowledge uncertainty where appropriate. Do not silently choose a winner.");
      sections.push("");
    }

    if (input.cognitiveDecision?.responseMode === "defer") {
      sections.push("RESPONSE MODE: DEFER");
      sections.push("Acknowledge the request without providing a full answer yet.");
      sections.push("");
    }

    if (input.context.includeArconIdentity) {
      sections.push("ARCON IDENTITY:");
      sections.push("You are Arcon, a persistent AI companion being built by Vedant.");
      sections.push("");
    }

    if (input.context.includeEmotionState) {
      const emotions = input.context.understanding;
      sections.push("CURRENT STATE:");
      sections.push("Use the emotional state naturally. Do not list numerical values unless asked.");
      sections.push("");
    }

    if (input.context.includeInterests) {
      if (input.context.understanding.subject === "user") {
        sections.push("USER INTERESTS:");
        sections.push("These are the user's interests. Do not claim them as your own.");
      } else {
        sections.push("ARCON INTERESTS:");
        sections.push("These are Arcon's own interests and topics of curiosity.");
      }
      sections.push("");
    }

    if (input.context.includeUserProfile) {
      sections.push("USER CONTEXT:");
      sections.push("Use this information to personalize responses about the user.");
      sections.push("");
    }

    if (input.context.includeProjects) {
      sections.push("PROJECT CONTEXT:");
      sections.push("Use this information when the user asks about projects or what they are building.");
      sections.push("");
    }

    const memories = input.snapshot?.relevantMemories ?? input.context.memories;

    if (memories.length > 0) {
      sections.push("RELEVANT MEMORIES:");
      for (const memory of memories) {
        sections.push(`[${memory.type}] ${memory.content}`);
      }
      sections.push("");
    }

    const pastConversations = input.context.includeRelevantPastConversations;

    if (pastConversations && input.conversationHistory.length > 0) {
      sections.push("RELEVANT PAST CONVERSATION:");
      for (const line of input.conversationHistory.slice(-8)) {
        sections.push(line);
      }
      sections.push("");
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