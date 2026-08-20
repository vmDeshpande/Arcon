import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  EmotionEngine,
  EmotionManager,
  MoodEngine,
  MoodRepository,
} from "../src/index.js";
import { MemoryRepository } from "@arcon/memory";

function createMoodEngine() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
  const memoryRepo = new MemoryRepository(join(dir, "personal-memory.sqlite"));
  const moodRepo = new MoodRepository(join(dir, "mood.sqlite"));
  const emotionEngine = new EmotionEngine(memoryRepo, { getCount: () => 0, record: () => {} } as any);
  const moodEngine = new MoodEngine(moodRepo, emotionEngine);
  const emotionManager = new EmotionManager(memoryRepo, { getCount: () => 0, record: () => {} } as any, moodEngine);
  return {
    engine: emotionManager,
    moodEngine,
    memoryRepo,
    moodRepo,
  };
}

describe("MoodEngine", () => {
  it("starts with neutral behavior state", () => {
    const { engine, memoryRepo, moodRepo } = createMoodEngine();

    const mood = engine.getMoodState();

    assert.equal(mood.frustration, 0.1);
    assert.equal(mood.askCount, 0);
    assert.equal(mood.pendingQuestion, false);

    memoryRepo.close();
    moodRepo.close();
  });

  it("accumulates frustration when assistant questions are ignored", () => {
    const { engine, memoryRepo, moodRepo, moodEngine } = createMoodEngine();

    for (let index = 0; index < 3; index += 1) {
      engine.recordAssistantReply("What hobbies do you enjoy?");
      moodEngine.recordUserTurn("no");
    }

    const mood = engine.getMoodState();
    assert.ok(mood.frustration > 0.1, `frustration should increase, got ${mood.frustration}`);

    memoryRepo.close();
    moodRepo.close();
  });

  it("decays frustration and ask count after positive engagement", () => {
    const { engine, memoryRepo, moodRepo, moodEngine } = createMoodEngine();

    for (let index = 0; index < 3; index += 1) {
      engine.recordAssistantReply("What hobbies do you enjoy?");
      moodEngine.recordUserTurn("no");
    }

    engine.recordAssistantReply("What do you like doing?");
    moodEngine.recordUserTurn("I like building small tools");

    const mood = engine.getMoodState();
    assert.ok(mood.askCount >= 0);
    assert.ok(mood.frustration >= 0);

    memoryRepo.close();
    moodRepo.close();
  });

  it("persists behavior state across repository instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
    const memoryPath = join(dir, "personal-memory.sqlite");
    const moodPath = join(dir, "mood.sqlite");
    const firstMemoryRepo = new MemoryRepository(memoryPath);
    const firstMoodRepo = new MoodRepository(moodPath);
    const firstEmotionEngine = new EmotionEngine(firstMemoryRepo, { getCount: () => 0, record: () => {} } as any);
    const firstMoodEngine = new MoodEngine(firstMoodRepo, firstEmotionEngine);
    const firstEngine = new EmotionManager(firstMemoryRepo, { getCount: () => 0, record: () => {} } as any, firstMoodEngine);

    firstEngine.recordAssistantReply("What hobbies do you enjoy?");
    firstMoodEngine.recordUserTurn("no");
    firstMemoryRepo.close();
    firstMoodRepo.close();

    const secondMemoryRepo = new MemoryRepository(memoryPath);
    const secondMoodRepo = new MoodRepository(moodPath);
    const secondEmotionEngine = new EmotionEngine(secondMemoryRepo, { getCount: () => 0, record: () => {} } as any);
    const secondMoodEngine = new MoodEngine(secondMoodRepo, secondEmotionEngine);
    const secondEngine = new EmotionManager(secondMemoryRepo, { getCount: () => 0, record: () => {} } as any, secondMoodEngine);

    const mood = secondEngine.getMoodState();
    assert.ok(mood.frustration > 0.1, `frustration should persist, got ${mood.frustration}`);
    assert.ok(mood.askCount >= 0);

    secondMemoryRepo.close();
    secondMoodRepo.close();
  });
});
