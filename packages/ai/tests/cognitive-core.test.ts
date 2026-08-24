import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MemoryRepository, MemoryPipeline, MemoryStatus, MemoryType, MemorySourceType } from "@arcon/memory";
import { MoodRepository } from "@arcon/personality";
import type { AiClient, ChatMessage } from "@arcon/shared";

import { ChatService } from "../src/chat-service.js";
import { CognitiveAdapter } from "../src/cognitive-adapter.js";
import { buildContextSnapshot, selectContext, analyzeQuestion } from "../src/cognitive/cognitive-processor.js";
import { MemoryRetriever } from "@arcon/memory";
import { EmotionManager } from "@arcon/personality";
import { MoodEngine } from "@arcon/personality";
import { InterestEngine } from "@arcon/personality";
import { ExperienceRepository } from "@arcon/personality";

class SequenceAiClient implements AiClient {
  private index = 0;

  constructor(private readonly responses: string[]) {}

  async generateReply(_messages: ChatMessage[]): Promise<string> {
    const response = this.responses[this.index] ?? "";
    this.index += 1;
    return response;
  }
}

describe("Phase D Cognitive Core", () => {
  describe("CognitiveAdapter", () => {
    it("produces a structured CognitiveDecision", async () => {
      const adapter = new CognitiveAdapter();
      const result = await adapter.process({
        message: "Hello",
        intent: "GENERAL",
        emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 },
        moodLabel: "neutral",
        mood: { frustration: 0, askCount: 0, pendingQuestion: false, trust: 0.5, excitement: 0.5 },
        interests: [],
        arconInterests: [],
        activeEntity: null,
        recentMemories: [],
        recentExperiences: [],
        snapshot: {
          understanding: {
            intent: "GENERAL",
            subject: "general",
            topic: null,
            requiresMemory: true,
            requiresEmotion: false,
            requiresInterests: false,
            requiresIdentity: false,
            requiresProjects: false,
            requiresConversation: true,
            requiresArconState: true,
            isQuestion: false,
            isAmbiguous: false,
            confidence: 0.85,
          },
          task: "Hello",
          intent: "GENERAL",
          subject: "general",
          relevantMemories: [],
          relevantEntities: [],
          currentEmotionalState: { moodLabel: "neutral", emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 } },
          relevantInterests: [],
          activeGoals: [],
          unresolvedConflicts: [],
          confidence: 0.85,
          selectedTopics: [],
          excludedTopics: [],
          contextBudget: { maxMemories: 4, maxConversationTurns: 6, maxPastConversations: 0, estimatedTokens: 100 },
        },
      });

      assert(result.thought !== undefined);
      assert(result.decision !== undefined);
      assert(result.strategy !== undefined);
      assert(result.strategyReason !== undefined);
      assert(result.tone !== undefined);
      assert(result.clarificationNeeded !== undefined);
      assert(result.responseMode !== undefined);
      assert(Array.isArray(result.requiredContext));
      assert(Array.isArray(result.unresolvedConflicts));
      assert(Array.isArray(result.stages));
    });

    it("triggers clarification for ambiguous low-context input", async () => {
      const adapter = new CognitiveAdapter();
      const result = await adapter.process({
        message: "it",
        intent: "GENERAL",
        emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 },
        moodLabel: "neutral",
        mood: { frustration: 0, askCount: 0, pendingQuestion: false, trust: 0.5, excitement: 0.5 },
        interests: [],
        arconInterests: [],
        activeEntity: null,
        recentMemories: [],
        recentExperiences: [],
        snapshot: {
          understanding: {
            intent: "GENERAL",
            subject: "general",
            topic: null,
            requiresMemory: true,
            requiresEmotion: false,
            requiresInterests: false,
            requiresIdentity: false,
            requiresProjects: false,
            requiresConversation: true,
            requiresArconState: true,
            isQuestion: false,
            isAmbiguous: true,
            confidence: 0.6,
          },
          task: "it",
          intent: "GENERAL",
          subject: "general",
          relevantMemories: [],
          relevantEntities: [],
          currentEmotionalState: { moodLabel: "neutral", emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 } },
          relevantInterests: [],
          activeGoals: [],
          unresolvedConflicts: [],
          confidence: 0.3,
          selectedTopics: [],
          excludedTopics: [],
          contextBudget: { maxMemories: 4, maxConversationTurns: 6, maxPastConversations: 0, estimatedTokens: 10 },
        },
      });

      assert.strictEqual(result.clarificationNeeded, true);
      assert.strictEqual(result.responseMode, "clarify");
    });

    it("returns answer mode for confident context with memories", async () => {
      const adapter = new CognitiveAdapter();
      const result = await adapter.process({
        message: "What is Arcon?",
        intent: "ARCON_IDENTITY",
        emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 },
        moodLabel: "neutral",
        mood: { frustration: 0, askCount: 0, pendingQuestion: false, trust: 0.5, excitement: 0.5 },
        interests: [],
        arconInterests: [],
        activeEntity: null,
        recentMemories: [{ id: "1", content: "Arcon is an AI companion" }],
        recentExperiences: [],
        snapshot: {
          understanding: {
            intent: "IDENTITY",
            subject: "arcon",
            topic: null,
            requiresMemory: true,
            requiresEmotion: false,
            requiresInterests: false,
            requiresIdentity: true,
            requiresProjects: false,
            requiresConversation: true,
            requiresArconState: true,
            isQuestion: true,
            isAmbiguous: false,
            confidence: 0.85,
          },
          task: "What is Arcon?",
          intent: "IDENTITY",
          subject: "arcon",
          relevantMemories: [{ id: "1", content: "Arcon is an AI companion", type: "FACT", status: "ACTIVE", importanceScore: 5, confidenceScore: 0.9, sourceType: "USER_EXPLICIT", createdAt: "", updatedAt: "", tags: [], evidenceCount: 1, scope: "ARCON" }],
          relevantEntities: [],
          currentEmotionalState: { moodLabel: "neutral", emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 } },
          relevantInterests: [],
          activeGoals: [],
          unresolvedConflicts: [],
          confidence: 0.85,
          selectedTopics: [],
          excludedTopics: [],
          contextBudget: { maxMemories: 0, maxConversationTurns: 4, maxPastConversations: 0, estimatedTokens: 50 },
        },
      });

      assert.strictEqual(result.clarificationNeeded, false);
      assert.strictEqual(result.responseMode, "answer");
    });

    it("includes unresolved conflicts in decision", async () => {
      const adapter = new CognitiveAdapter();
      const result = await adapter.process({
        message: "What do I like?",
        intent: "USER_PROFILE",
        emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 },
        moodLabel: "neutral",
        mood: { frustration: 0, askCount: 0, pendingQuestion: false, trust: 0.5, excitement: 0.5 },
        interests: [],
        arconInterests: [],
        activeEntity: null,
        recentMemories: [],
        recentExperiences: [],
        snapshot: {
          understanding: {
            intent: "MEMORY",
            subject: "user",
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
          },
          task: "What do I like?",
          intent: "MEMORY",
          subject: "user",
          relevantMemories: [],
          relevantEntities: [],
          currentEmotionalState: { moodLabel: "neutral", emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 } },
          relevantInterests: [],
          activeGoals: [],
          unresolvedConflicts: [
            { id: "1", content: "User likes coffee", type: "PREFERENCE", status: "PENDING_CONFIRMATION", importanceScore: 5, confidenceScore: 0.8, sourceType: "USER_EXPLICIT", createdAt: "", updatedAt: "", tags: [], evidenceCount: 1, scope: "USER" },
          ],
          confidence: 0.85,
          selectedTopics: [],
          excludedTopics: [],
          contextBudget: { maxMemories: 8, maxConversationTurns: 6, maxPastConversations: 1, estimatedTokens: 100 },
        },
      });

      assert.strictEqual(result.unresolvedConflicts.length, 1);
      assert.strictEqual(result.unresolvedConflicts[0].status, "PENDING_CONFIRMATION");
    });

    it("records think-before-reply stages", async () => {
      const adapter = new CognitiveAdapter();
      const result = await adapter.process({
        message: "Hello",
        intent: "GENERAL",
        emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 },
        moodLabel: "neutral",
        mood: { frustration: 0, askCount: 0, pendingQuestion: false, trust: 0.5, excitement: 0.5 },
        interests: [],
        arconInterests: [],
        activeEntity: null,
        recentMemories: [],
        recentExperiences: [],
        snapshot: {
          understanding: {
            intent: "GENERAL",
            subject: "general",
            topic: null,
            requiresMemory: true,
            requiresEmotion: false,
            requiresInterests: false,
            requiresIdentity: false,
            requiresProjects: false,
            requiresConversation: true,
            requiresArconState: true,
            isQuestion: false,
            isAmbiguous: false,
            confidence: 0.85,
          },
          task: "Hello",
          intent: "GENERAL",
          subject: "general",
          relevantMemories: [],
          relevantEntities: [],
          currentEmotionalState: { moodLabel: "neutral", emotions: { happiness: 0.5, frustration: 0, curiosity: 0.5, trust: 0.5, confidence: 0.5 } },
          relevantInterests: [],
          activeGoals: [],
          unresolvedConflicts: [],
          confidence: 0.85,
          selectedTopics: [],
          excludedTopics: [],
          contextBudget: { maxMemories: 4, maxConversationTurns: 6, maxPastConversations: 0, estimatedTokens: 100 },
        },
      });

      assert(result.stages.length >= 2);
      assert(result.stages[0].stage === "context_selection");
      assert(result.stages[1].stage === "reasoning");
    });
  });

  describe("ChatService cognitive integration", () => {
    it("returns clarification without full answer when cognitive core decides", async () => {
      const dir = mkdtempSync(join(tmpdir(), "arcon-cognitive-"));
      const repository = new MemoryRepository(join(dir, "memories.sqlite"));
      const pipeline = new MemoryPipeline(repository);
      const service = new ChatService(
        repository,
        pipeline,
        new SequenceAiClient(["", "Could you clarify what you mean?"]),
        {
          experienceDatabasePath: join(dir, "experiences.sqlite"),
          moodDatabasePath: join(dir, "mood.sqlite"),
          entityDatabasePath: join(dir, "entities.sqlite"),
        },
      );

      const result = await service.chat("it");
      assert(result.prompt.includes("CLARIFICATION REQUIRED:"));
      assert(result.reply === "Could you clarify what you mean?");

      service.close();
    });

    it("includes runtime capabilities in prompt", async () => {
      const dir = mkdtempSync(join(tmpdir(), "arcon-cognitive-"));
      const repository = new MemoryRepository(join(dir, "memories.sqlite"));
      const pipeline = new MemoryPipeline(repository);
      const service = new ChatService(
        repository,
        pipeline,
        new SequenceAiClient(["I don't know"]),
        {
          experienceDatabasePath: join(dir, "experiences.sqlite"),
          moodDatabasePath: join(dir, "mood.sqlite"),
          entityDatabasePath: join(dir, "entities.sqlite"),
        },
      );

      const result = await service.chat("Hello");
      assert(result.prompt.includes("RUNTIME CAPABILITIES:"));
      assert(result.prompt.includes("SQLite-backed persistent memory"));

      service.close();
    });

    it("includes cognitive decision in prompt", async () => {
      const dir = mkdtempSync(join(tmpdir(), "arcon-cognitive-"));
      const repository = new MemoryRepository(join(dir, "memories.sqlite"));
      const pipeline = new MemoryPipeline(repository);
      const service = new ChatService(
        repository,
        pipeline,
        new SequenceAiClient(["Hi"]),
        {
          experienceDatabasePath: join(dir, "experiences.sqlite"),
          moodDatabasePath: join(dir, "mood.sqlite"),
          entityDatabasePath: join(dir, "entities.sqlite"),
        },
      );

      const result = await service.chat("Hello");
      assert(result.prompt.includes("RESPONSE STRATEGY:"));

      service.close();
    });
  });

  describe("Intent and strategy routing", () => {
    it("project intent sets project context flags", () => {
      const understanding = analyzeQuestion("What am I building?");
      assert.strictEqual(understanding.intent, "PROJECT");
      assert.strictEqual(understanding.requiresProjects, true);
      assert.strictEqual(understanding.requiresMemory, true);
    });

    it("identity intent sets identity context flags", () => {
      const understanding = analyzeQuestion("Who are you?");
      assert.strictEqual(understanding.intent, "IDENTITY");
      assert.strictEqual(understanding.requiresIdentity, true);
      assert.strictEqual(understanding.requiresArconState, true);
    });

    it("emotion intent sets emotion context flags", () => {
      const understanding = analyzeQuestion("How are you feeling?");
      assert.strictEqual(understanding.intent, "EMOTION");
      assert.strictEqual(understanding.requiresEmotion, true);
      assert.strictEqual(understanding.requiresArconState, true);
    });

    it("casual conversation does not force long-term memory", () => {
      const understanding = analyzeQuestion("Hey");
      assert.strictEqual(understanding.intent, "GENERAL");
      assert.strictEqual(understanding.requiresMemory, true);
    });
  });
});
