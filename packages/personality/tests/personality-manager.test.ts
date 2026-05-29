import { describe, it } from "node:test";
import assert from "node:assert";

import {
  DEFAULT_PERSONALITY,
  MoodEngine,
  PersonalityManager
} from "../src/index.js";

describe("PersonalityManager", () => {
  it("builds a system prompt", () => {
    const mood = new MoodEngine();

    const manager = new PersonalityManager(
      DEFAULT_PERSONALITY,
      mood
    );

    const prompt = manager.getSystemPrompt();

    assert(prompt.includes("Arcon"));
    assert(prompt.includes("neutral"));
    assert(prompt.includes("Curiosity"));
  });

  it("reflects mood changes", () => {
    const mood = new MoodEngine();

    mood.setMood("curious");

    const manager = new PersonalityManager(
      DEFAULT_PERSONALITY,
      mood
    );

    const prompt = manager.getSystemPrompt();

    assert(prompt.includes("curious"));
  });
});