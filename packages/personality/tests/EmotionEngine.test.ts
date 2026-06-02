import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  EmotionEngine,
  InterestEngine,
  ExperienceManager,
  ExperienceRepository,
  ExperienceType,
} from "../src/index.js";
import { MemoryRepository } from "@arcon/memory";

function createTestContext() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-emotion-"));
  const memoryRepo = new MemoryRepository(join(dir, "memories.sqlite"));
  const experienceRepo = new ExperienceRepository(join(dir, "experiences.sqlite"));
  const experienceManager = new ExperienceManager(experienceRepo);
  const emotionEngine = new EmotionEngine(memoryRepo, experienceManager);
  const interestEngine = new InterestEngine(memoryRepo);

  return {
    dir,
    memoryRepo,
    experienceRepo,
    emotionEngine,
    interestEngine,
  };
}

describe("EmotionEngine and InterestEngine", () => {
  it("increases happiness and trust after praise", () => {
    const { memoryRepo, experienceRepo, emotionEngine } = createTestContext();

    emotionEngine.updateOnEvent(ExperienceType.USER_PRAISED_ARCON);

    const emotions = emotionEngine.getCurrentEmotions();

    assert.ok(emotions.happiness > 0, "happiness should increase");
    assert.ok(emotions.trust > 0, "trust should increase");

    experienceRepo.close();
    memoryRepo.close();
  });

  it("increases frustration when self questions are repeated", () => {
    const { memoryRepo, experienceRepo, emotionEngine } = createTestContext();

    emotionEngine.updateOnEvent(ExperienceType.USER_ASKED_SELF);
    emotionEngine.updateOnEvent(ExperienceType.USER_ASKED_SELF);
    emotionEngine.updateOnEvent(ExperienceType.USER_ASKED_SELF);

    const emotions = emotionEngine.getCurrentEmotions();

    assert.ok(emotions.frustration > 0, "frustration should rise after repeated self questions");

    experienceRepo.close();
    memoryRepo.close();
  });

  it("decays emotions and interest weights over time", () => {
    const { memoryRepo, experienceRepo, emotionEngine, interestEngine } = createTestContext();

    emotionEngine.updateOnEvent(ExperienceType.USER_PRAISED_ARCON);
    interestEngine.updateFromText("I love music and travel.");

    const beforeEmotions = emotionEngine.getCurrentEmotions();
    const beforeInterests = interestEngine.getTopInterests();

    interestEngine.decay(3600 * 1000);
    emotionEngine.decay(3600 * 1000);

    const afterEmotions = emotionEngine.getCurrentEmotions();
    const afterInterests = interestEngine.getTopInterests();

    assert.ok(afterEmotions.happiness < beforeEmotions.happiness, "happiness should decay over time");
    assert.ok(afterInterests.length > 0, "interests should still exist after decay");
    assert.ok(afterInterests[0].weight <= beforeInterests[0].weight, "interest weight should decrease after decay");

    experienceRepo.close();
    memoryRepo.close();
  });

  it("persists emotion and interest state in the memory database", () => {
    const { memoryRepo, experienceRepo, emotionEngine, interestEngine } = createTestContext();

    emotionEngine.updateOnEvent(ExperienceType.USER_PRAISED_ARCON);
    interestEngine.updateFromText("I enjoy music and travel.");

    const emotionRows = memoryRepo.listEmotions();
    const interestRows = memoryRepo.listInterests();

    assert.ok(emotionRows.some((row) => row.name === "happiness" && row.value > 0));
    assert.ok(interestRows.some((row) => row.topic === "music"));
    assert.ok(interestRows.some((row) => row.topic === "travel"));

    experienceRepo.close();
    memoryRepo.close();
  });
});
