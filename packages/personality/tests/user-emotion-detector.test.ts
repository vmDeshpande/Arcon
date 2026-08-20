import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectUserEmotion } from "../src/emotion/user-emotion-detector.js";

describe("UserEmotionDetector", () => {
  it("detects preference from 'I really like programming'", () => {
    const result = detectUserEmotion("I really like programming");
    assert.ok(result);
    assert.equal(result?.type, "USER_SHARED_PREFERENCE");
  });

  it("detects preference from 'My favorite food is buttermilk'", () => {
    const result = detectUserEmotion("My favorite food is buttermilk");
    assert.ok(result);
    assert.equal(result?.type, "USER_SHARED_PREFERENCE");
  });

  it("detects excitement from 'I'm really excited today!'", () => {
    const result = detectUserEmotion("I'm really excited today!");
    assert.ok(result);
    assert.equal(result?.type, "USER_EMOTIONAL_EXCITED");
  });

  it("detects frustration from 'This is so frustrating'", () => {
    const result = detectUserEmotion("This is so frustrating");
    assert.ok(result);
    assert.equal(result?.type, "USER_EMOTIONAL_FRUSTRATED");
  });

  it("detects success from 'I finally finished it'", () => {
    const result = detectUserEmotion("I finally finished it");
    assert.ok(result);
    assert.equal(result?.type, "USER_EMOTIONAL_EXCITED");
  });

  it("rejects long-distance nonsensical subject/verb patterns", () => {
    const result = detectUserEmotion("I walking around the park and enjoy programming");
    assert.equal(result, null);
  });

  it("rejects unrelated sentences containing emotional keywords", () => {
    const result = detectUserEmotion("I think therefore I am");
    assert.equal(result, null);
  });

  it("rejects 'I do not like this' as no positive preference", () => {
    const result = detectUserEmotion("I do not like this");
    assert.equal(result, null);
  });

  it("detects trust from 'I trust you'", () => {
    const result = detectUserEmotion("I trust you");
    assert.ok(result);
    assert.equal(result?.type, "USER_SHOWED_TRUST");
  });

  it("detects opinion request from 'What do you think about it?'", () => {
    const result = detectUserEmotion("What do you think about it?");
    assert.ok(result);
    assert.equal(result?.type, "USER_ASKED_OPINION");
  });
});
