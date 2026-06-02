import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_PERSONALITY,
  MoodEngine,
  MoodRepository,
  PersonalityManager,
  buildBehaviorPrompt,
} from "../src/index.js";

function createMoodEngine() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
  const repository = new MoodRepository(join(dir, "mood.sqlite"));
  return {
    engine: new MoodEngine(repository),
    repository,
  };
}

describe("PersonalityManager", () => {
  it("builds a system prompt with behavior state", () => {
    const { engine, repository } = createMoodEngine();

    engine.recordAssistantReply("What hobbies do you enjoy?");
    engine.recordUserTurn("My dog likes pedigree");

    const manager = new PersonalityManager(
      DEFAULT_PERSONALITY,
      engine,
    );

    const prompt = manager.getSystemPrompt();

    assert(prompt.includes("Arcon"));
    assert(prompt.includes("Frustration Level: 1"));
    assert(prompt.includes("Ask Count: 1"));
    assert(prompt.includes("Curiosity"));

    repository.close();
  });

  it("behavior prompt changes instruction thresholds by ask count", () => {
    const prompt = buildBehaviorPrompt({
      moodLabel: "skeptical",
      emotions: {
        happiness: 0.2,
        frustration: 0.5,
        curiosity: 0.4,
        trust: 0.5,
        confidence: 0.3,
      },
      mood: {
        curiosity: 0.5,
        frustration: 5,
        askCount: 6,
        pendingQuestion: false,
        trust: 0.5,
        excitement: 0.5,
        updatedAt: new Date().toISOString(),
      },
      interests: [],
    });

    assert(prompt.includes("Frustration Level: 5"));
    assert(prompt.includes("Ask Count: 6"));
    assert(prompt.includes("Mostly use statements"));
  });
});
