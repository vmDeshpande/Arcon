import { describe, it } from "node:test";
import assert from "node:assert";

import { MoodEngine } from "../src/mood-engine.js";

describe("MoodEngine", () => {
  it("starts neutral", () => {
    const mood = new MoodEngine();

    assert.strictEqual(
      mood.getMood(),
      "neutral"
    );
  });

  it("changes mood", () => {
    const mood = new MoodEngine();

    mood.setMood("focused");

    assert.strictEqual(
      mood.getMood(),
      "focused"
    );
  });

  it("resets mood", () => {
    const mood = new MoodEngine();

    mood.setMood("excited");

    mood.reset();

    assert.strictEqual(
      mood.getMood(),
      "neutral"
    );
  });
});