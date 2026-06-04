import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  EmotionManager,
} from "../src/emotion/index.js";
import { MemoryRepository } from "@arcon/memory";

function createMoodEngine() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
  const repository = new MemoryRepository(join(dir, "personal-memory.sqlite"));
  return {
    engine: new EmotionManager(repository, { getCount: () => 0, record: () => {} } as any),
    repository,
  };
}

describe("MoodEngine", () => {
  it("starts with neutral behavior state", () => {
    const { engine, repository } = createMoodEngine();

    const mood = engine.getMoodState();

    assert.equal(mood.frustration, 0);
    assert.equal(mood.askCount, 0);
    assert.equal(mood.pendingQuestion, false);

    repository.close();
  });

  it("accumulates frustration when assistant questions are ignored", () => {
    const { engine, repository } = createMoodEngine();

    for (let index = 0; index < 3; index += 1) {
      engine.recordAssistantReply("What hobbies do you enjoy?");
      engine.recordUserTurn("My dog likes pedigree");
    }

    // frustration is stored 0-1; three ignored questions should increase it
    const mood = engine.getMoodState();
    assert.equal(mood.frustration, 3);

    repository.close();
  });

  it("decays frustration and ask count after positive engagement", () => {
    const { engine, repository } = createMoodEngine();

    for (let index = 0; index < 3; index += 1) {
      engine.recordAssistantReply("What hobbies do you enjoy?");
      engine.recordUserTurn("My dog likes pedigree");
    }

    engine.recordAssistantReply("What do you like doing?");
    engine.recordUserTurn("I like building small tools");

    const mood = engine.getMoodState();
    assert.equal(mood.frustration, 2);
    assert.equal(mood.askCount, 3);

    repository.close();
  });

  it("persists behavior state across repository instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
    const path = join(dir, "personal-memory.sqlite");
    const firstRepository = new MemoryRepository(path);
    const firstEngine = new EmotionManager(firstRepository, { getCount: () => 0, record: () => {} } as any);

    firstEngine.recordAssistantReply("What hobbies do you enjoy?");
    firstEngine.recordUserTurn("My dog likes pedigree");
    firstRepository.close();

    const secondRepository = new MemoryRepository(path);
    const secondEngine = new EmotionManager(secondRepository, { getCount: () => 0, record: () => {} } as any);

    const mood = secondEngine.getMoodState();
    assert.equal(mood.frustration, 1);
    assert.equal(mood.askCount, 1);

    secondRepository.close();
  });
});
