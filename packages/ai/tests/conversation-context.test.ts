import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ConversationContext } from "../src/conversation-context.js";

describe("ConversationContext", () => {
  it("loads recent messages from store", () => {
    const context = new ConversationContext(3);
    const messages = [
      { role: "user", content: "First", createdAt: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "Second", createdAt: "2026-01-01T00:00:01Z" },
      { role: "user", content: "Third", createdAt: "2026-01-01T00:00:02Z" },
      { role: "assistant", content: "Fourth", createdAt: "2026-01-01T00:00:03Z" },
    ];

    context.loadFromMessages("conv-1", messages);

    const history = context.getHistory("conv-1");
    assert.equal(history.length, 3);
    assert.equal(history[0].content, "Second");
    assert.equal(history[1].content, "Third");
    assert.equal(history[2].content, "Fourth");
  });

  it("filters system messages during load", () => {
    const context = new ConversationContext();
    const messages = [
      { role: "system", content: "System prompt", createdAt: "2026-01-01T00:00:00Z" },
      { role: "user", content: "Hello", createdAt: "2026-01-01T00:00:01Z" },
      { role: "assistant", content: "Hi", createdAt: "2026-01-01T00:00:02Z" },
    ];

    context.loadFromMessages("conv-1", messages);

    const history = context.getHistory("conv-1");
    assert.equal(history.length, 2);
    assert.equal(history[0].content, "Hello");
    assert.equal(history[1].content, "Hi");
  });

  it("preserves empty history for unknown conversation", () => {
    const context = new ConversationContext();

    const history = context.getHistory("unknown");
    assert.equal(history.length, 0);
  });

  it("adds turns after load", () => {
    const context = new ConversationContext(2);
    const messages = [
      { role: "user", content: "First", createdAt: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "Second", createdAt: "2026-01-01T00:00:01Z" },
    ];

    context.loadFromMessages("conv-1", messages);
    context.addUserMessage("conv-1", "Third");

    const history = context.getHistory("conv-1");
    assert.equal(history.length, 2);
    assert.equal(history[0].content, "Second");
    assert.equal(history[1].content, "Third");
  });
});
