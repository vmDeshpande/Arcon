import { describe, it } from "node:test";
import assert from "node:assert";

import { PromptBuilder } from "../src/prompt-builder.js";
import { DEFAULT_CAPABILITIES } from "../src/runtime-capabilities.js";
import { DEFAULT_RUNTIME_IDENTITY } from "../src/runtime-identity.js";
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

  it("includes runtime capabilities in prompt", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext(),
      conversationHistory: [],
      userMessage: "Hello",
      capabilities: DEFAULT_CAPABILITIES,
    });

    assert(prompt.includes("RUNTIME CAPABILITIES:"));
    assert(prompt.includes("persistent personal memory"));
    assert(prompt.includes("IMPLEMENTED"));
  });

  it("includes runtime identity in prompt", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext(),
      conversationHistory: [],
      userMessage: "Hello",
      runtimeIdentity: {
        ...DEFAULT_RUNTIME_IDENTITY,
        baseModel: "Qwen/Qwen3-4B",
        adapterName: "arcon-v1",
        adapterVersion: "rank-8",
        adapterActive: true,
      },
    });

    assert(prompt.includes("RUNTIME IDENTITY:"));
    assert(prompt.includes("Base model: Qwen/Qwen3-4B"));
    assert(prompt.includes("Adapter: arcon-v1 (rank-8)"));
    assert(prompt.includes("Adapter active: yes"));
  });

  it("omits capabilities when not provided", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      context: createContext(),
      conversationHistory: [],
      userMessage: "Hello",
    });

    assert(!prompt.includes("RUNTIME CAPABILITIES:"));
    assert(!prompt.includes("RUNTIME IDENTITY:"));
  });
});
