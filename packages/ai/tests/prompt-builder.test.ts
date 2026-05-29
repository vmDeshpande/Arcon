import { describe, it } from "node:test";
import assert from "node:assert";

import { PromptBuilder } from "../src/prompt-builder.js";

describe("PromptBuilder", () => {
  it("builds a complete prompt", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      memoryContext: "User prefers TypeScript",
      conversationHistory: [
        "User: Hello",
        "Assistant: Hi"
      ],
      userMessage: "How should I structure my monorepo?"
    });

    assert(prompt.includes("SYSTEM:"));
    assert(prompt.includes("MEMORIES:"));
    assert(prompt.includes("CONVERSATION:"));
    assert(prompt.includes("USER:"));

    assert(prompt.includes("You are Arcon."));
    assert(prompt.includes("User prefers TypeScript"));
    assert(prompt.includes("How should I structure my monorepo?"));
  });

  it("handles empty memories", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      memoryContext: "",
      conversationHistory: [],
      userMessage: "Hello"
    });

    assert(prompt.includes("No relevant memories."));
  });

  it("handles empty conversation history", () => {
    const builder = new PromptBuilder();

    const prompt = builder.build({
      systemPrompt: "You are Arcon.",
      memoryContext: "User likes TypeScript",
      conversationHistory: [],
      userMessage: "Hello"
    });

    assert(prompt.includes("No previous conversation."));
  });
});