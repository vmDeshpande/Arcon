import { describe, it } from "node:test";
import assert from "node:assert";
import { classifyArconExperience } from "@arcon/ai";
import { ExperienceType } from "@arcon/personality";

describe("ArconExperienceClassifier", () => {
  it("classifies a question as ARCON_ASKED_QUESTION", () => {
    const result = classifyArconExperience("How are you feeling?", "natural", "conversation");
    assert.strictEqual(result, ExperienceType.ARCON_ASKED_QUESTION);
  });

  it("classifies celebration", () => {
    const result = classifyArconExperience("That's awesome! Congratulations!", "celebrate", "conversation");
    assert.strictEqual(result, ExperienceType.ARCON_CELEBRATED_WITH_USER);
  });

  it("classifies comfort", () => {
    const result = classifyArconExperience("I'm sorry to hear that. That sounds rough.", "comfort", "conversation");
    assert.strictEqual(result, ExperienceType.ARCON_COMFORTED_USER);
  });

  it("classifies answer", () => {
    const result = classifyArconExperience("Based on my analysis, the issue is in the STT module.", "answer", "debug");
    assert.strictEqual(result, ExperienceType.ARCON_PROVIDED_ANSWER);
  });

  it("classifies acknowledgement", () => {
    const result = classifyArconExperience("Let's fix this together.", "acknowledge", "conversation");
    assert.strictEqual(result, ExperienceType.ARCON_ACKNOWLEDGED_USER);
  });

  it("returns null for neutral responses", () => {
    const result = classifyArconExperience("Okay.", "acknowledge", "conversation");
    assert.strictEqual(result, null);
  });
});
