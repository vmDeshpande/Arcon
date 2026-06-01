import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MoodEngine,
  MoodRepository,
} from "../src/mood/index.js";

function createMoodEngine() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
  const repository = new MoodRepository(join(dir, "mood.sqlite"));
  return {
    engine: new MoodEngine(repository),
    repository,
  };
}

describe("MoodEngine", () => {
  it("starts with neutral behavior state", () => {
    const { engine, repository } = createMoodEngine();

    assert.equal(engine.getMood().frustration, 0);
    assert.equal(engine.getMood().askCount, 0);
    assert.equal(engine.getMood().pendingQuestion, false);

    repository.close();
  });

  it("accumulates frustration when assistant questions are ignored", () => {
    const { engine, repository } = createMoodEngine();

    for (let index = 0; index < 3; index += 1) {
      engine.recordAssistantReply("What hobbies do you enjoy?");
      engine.recordUserTurn("My dog likes pedigree");
    }

    assert.equal(engine.getMood().frustration, 3);

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

    assert.equal(engine.getMood().frustration, 2);
    assert.equal(engine.getMood().askCount, 3);

    repository.close();
  });

  it("persists behavior state across repository instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcon-mood-"));
    const path = join(dir, "mood.sqlite");
    const firstRepository = new MoodRepository(path);
    const firstEngine = new MoodEngine(firstRepository);

    firstEngine.recordAssistantReply("What hobbies do you enjoy?");
    firstEngine.recordUserTurn("My dog likes pedigree");
    firstRepository.close();

    const secondRepository = new MoodRepository(path);
    const secondEngine = new MoodEngine(secondRepository);

    assert.equal(secondEngine.getMood().frustration, 1);
    assert.equal(secondEngine.getMood().askCount, 1);

    secondRepository.close();
  });
});
