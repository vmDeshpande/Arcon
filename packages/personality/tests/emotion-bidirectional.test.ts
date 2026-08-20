import { describe, it } from "node:test";
import assert from "node:assert";
import { EmotionManager } from "@arcon/personality";
import { ExperienceManager, ExperienceRepository } from "@arcon/personality";
import { MemoryRepository } from "@arcon/memory";

describe("EmotionManager bidirectional processing", () => {
  const dbPath = `.tmp-tests/emotion-bidirectional-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;

  it("user turn increases happiness on positive engagement", () => {
    const repo = new MemoryRepository(dbPath);
    const experiences = new ExperienceManager(new ExperienceRepository(`.tmp-tests/exp-${Date.now()}.sqlite`));
    const engine = new EmotionManager(repo, experiences);

    const before = engine.getCurrentEmotions();
    engine.recordUserTurn("I really like programming");
    const after = engine.getCurrentEmotions();

    assert.ok(after.happiness > before.happiness, "happiness should increase");
    assert.ok(after.trust > before.trust, "trust should increase");
    repo.close();
  });

  it("assistant turn increases confidence when providing an answer", () => {
    const repo = new MemoryRepository(dbPath);
    const experiences = new ExperienceManager(new ExperienceRepository(`.tmp-tests/exp2-${Date.now()}.sqlite`));
    const engine = new EmotionManager(repo, experiences);

    engine.recordAssistantTurn("I think the issue is in the STT module.", {
      strategy: "answer",
      intent: "debug",
      arconInterests: [],
    });

    const after = engine.getCurrentEmotions();
    assert.ok(after.confidence > 0, "confidence should increase");
    repo.close();
  });

  it("assistant turn increases happiness when celebrating with user", () => {
    const repo = new MemoryRepository(dbPath);
    const experiences = new ExperienceManager(new ExperienceRepository(`.tmp-tests/exp3-${Date.now()}.sqlite`));
    const engine = new EmotionManager(repo, experiences);

    engine.recordAssistantTurn("That's awesome! Congratulations!", {
      strategy: "celebrate",
      intent: "conversation",
      arconInterests: [],
    });

    const after = engine.getCurrentEmotions();
    assert.ok(after.happiness > 0, "happiness should increase");
    repo.close();
  });

  it("assistant turn increases curiosity when asking a question", () => {
    const repo = new MemoryRepository(dbPath);
    const experiences = new ExperienceManager(new ExperienceRepository(`.tmp-tests/exp4-${Date.now()}.sqlite`));
    const engine = new EmotionManager(repo, experiences);

    engine.recordAssistantTurn("What made you interested in DOOM?", {
      strategy: "explore",
      intent: "conversation",
      arconInterests: [],
    });

    const after = engine.getCurrentEmotions();
    assert.ok(after.curiosity > 0, "curiosity should increase");
    repo.close();
  });

  it("user and assistant events are distinguishable", () => {
    const repo = new MemoryRepository(dbPath);
    const experiences = new ExperienceManager(new ExperienceRepository(`.tmp-tests/exp5-${Date.now()}.sqlite`));
    const engine = new EmotionManager(repo, experiences);

    engine.recordAssistantReply("How are you feeling?");
    engine.recordUserTurn("no");

    engine.recordAssistantTurn("I'm sorry to hear that.", {
      strategy: "comfort",
      intent: "conversation",
      arconInterests: [],
    });

    const after = engine.getCurrentEmotions();
    assert.ok(after.frustration > 0, "user frustration should persist");
    assert.ok(after.trust > 0, "assistant comfort should increase trust");
    repo.close();
  });
});
