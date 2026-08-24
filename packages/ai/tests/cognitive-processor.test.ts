import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemorySourceType,
  MemoryScope,
} from "@arcon/memory";
import { EmotionManager, MoodEngine, InterestEngine, ExperienceRepository, MoodRepository } from "@arcon/personality";
import { selectContext, buildContextSnapshot, analyzeQuestion } from "../src/cognitive/cognitive-processor.js";
import { MemoryRetriever } from "@arcon/memory";

describe("Phase C Context Selection", () => {
  let repository: MemoryRepository;
  let emotionManager: EmotionManager;
  let moodEngine: MoodEngine;
  let interestEngine: InterestEngine;

  beforeEach(() => {
    const tempDir = join(process.cwd(), ".tmp-tests");

    mkdirSync(tempDir, {
      recursive: true
    });

    const dbPath = join(
      tempDir,
      `context-${Date.now()}-${Math.random()}.sqlite`
    );

    repository = new MemoryRepository(dbPath);
    emotionManager = new EmotionManager(repository, new ExperienceRepository(join(tempDir, `exp-${Date.now()}.sqlite`)));
    moodEngine = new MoodEngine(new MoodRepository(join(tempDir, `mood-${Date.now()}.sqlite`)), emotionManager);
    interestEngine = new InterestEngine(repository);
  });

  it("populates selectedTopics from intent and message", () => {
    const understanding = analyzeQuestion("What are my interests in programming?");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "What are my interests in programming?",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    assert(selection.selectedTopics.length > 0);
    assert(selection.selectedTopics.includes("interest"));
    assert(selection.selectedTopics.includes("programming"));
  });

  it("populates excludedTopics from intent", () => {
    const understanding = analyzeQuestion("Tell me about your emotions");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "Tell me about your emotions",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    assert(selection.excludedTopics.length > 0);
    assert(selection.excludedTopics.includes("project"));
  });

  it("sets maxMemories per intent", () => {
    const understanding = analyzeQuestion("Tell me about your emotions");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "Tell me about your emotions",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    assert.strictEqual(selection.maxMemories, 2);
  });

  it("builds context snapshot with structured state", () => {
    const understanding = analyzeQuestion("How are you feeling?");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "How are you feeling?",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    const snapshot = buildContextSnapshot(
      selection,
      "How are you feeling?",
      emotionManager,
      moodEngine,
      interestEngine,
      repository
    );

    assert.strictEqual(snapshot.task, "How are you feeling?");
    assert.strictEqual(snapshot.intent, "EMOTION");
    assert(snapshot.contextBudget.maxMemories > 0);
    assert(Array.isArray(snapshot.relevantMemories));
    assert(Array.isArray(snapshot.relevantInterests));
  });

  it("does not retrieve memories for IDENTITY intent", () => {
    const understanding = analyzeQuestion("Who are you?");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "Who are you?",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    assert.strictEqual(selection.maxMemories, 0);
    assert.strictEqual(selection.memories.length, 0);
  });

  it("uses ARCON scope for arcon-subject queries", () => {
    const understanding = analyzeQuestion("What is your name?");
    const retriever = new MemoryRetriever(repository);

    const selection = selectContext(
      understanding,
      "What is your name?",
      repository,
      retriever,
      emotionManager,
      moodEngine,
      interestEngine,
      { getRelevantConversationHistory: () => [] } as any,
      "conv-1"
    );

    assert(selection.memories.length === 0);
  });
});
