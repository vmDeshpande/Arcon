import { describe, it } from "node:test";
import assert from "node:assert";

import { PromptBuilder } from "../src/prompt-builder.js";
import type { ContextSelection } from "../src/cognitive/context-selection.js";
import type { QuestionUnderstanding } from "../src/cognitive/question-understanding.js";

function createContext(overrides: Partial<ContextSelection> = {}): ContextSelection {
  const understanding: QuestionUnderstanding = {
    intent: "GENERAL",
    subject: "general",
    topic: null,
    requiresMemory: true,
    requiresEmotion: false,
    requiresInterests: false,
    requiresIdentity: false,
    requiresProjects: false,
    requiresConversation: true,
    requiresArconState: false,
    isQuestion: true,
    isAmbiguous: false,
    confidence: 0.85,
  };

  return {
    understanding,
    memories: [],
    includeUserProfile: false,
    includeArconIdentity: false,
    includeEmotionState: false,
    includeInterests: false,
    includeProjects: false,
    includeRecentConversation: false,
    includeRelevantPastConversations: false,
    maxConversationTurns: 6,
    maxPastConversations: 1,
    maxMemories: 5,
    selectedTopics: [],
    excludedTopics: [],
    ...overrides,
  };
}

describe("PromptBuilder", () => {
  it("builds a complete prompt", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext({ memories: [], includeArconIdentity: true }),
      conversationHistory: [
        "User: Hello",
        "Assistant: Hi"
      ],
      userMessage: "How should I structure my monorepo?"
    });

    assert(prompt.includes("SYSTEM:"));
    assert(prompt.includes("ARCON IDENTITY:"));
    assert(prompt.includes("CONVERSATION:"));
    assert(prompt.includes("USER:"));

    assert(prompt.includes("You are Arcon."));
    assert(prompt.includes("How should I structure my monorepo?"));
  });

  it("handles empty memories", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext(),
      conversationHistory: [],
      userMessage: "Hello"
    });

    assert(prompt.includes("No previous conversation."));
  });

  it("handles empty conversation history", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext({ includeArconIdentity: true }),
      conversationHistory: [],
      userMessage: "Hello"
    });

    assert(prompt.includes("No previous conversation."));
    assert(prompt.includes("ARCON IDENTITY:"));
  });
});
