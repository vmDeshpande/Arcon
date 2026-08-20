import { describe, it } from "node:test";
import assert from "node:assert";
import { ConversationStore } from "@arcon/memory";

describe("ConversationStore", () => {
  it("creates a conversation", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation({ topics: ["doom"], summary: "DOOM talk" });

    assert.strictEqual(conversation.messageCount, 0);
    assert.deepStrictEqual(conversation.topics, ["doom"]);
    assert.strictEqual(conversation.summary, "DOOM talk");
    store.close();
  });

  it("stores and retrieves messages", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation();

    store.storeMessage({ conversationId: conversation.id, role: "user", content: "I like DOOM" });
    store.storeMessage({ conversationId: conversation.id, role: "assistant", content: "DOOM is great" });

    const messages = store.getMessages(conversation.id);
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[0].role, "user");
    assert.strictEqual(messages[0].content, "I like DOOM");
    assert.strictEqual(messages[1].role, "assistant");
    assert.strictEqual(messages[1].content, "DOOM is great");
    store.close();
  });

  it("retrieves recent messages in chronological order", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation();

    store.storeMessage({ conversationId: conversation.id, role: "user", content: "msg1" });
    store.storeMessage({ conversationId: conversation.id, role: "assistant", content: "msg2" });
    store.storeMessage({ conversationId: conversation.id, role: "user", content: "msg3" });

    const recent = store.getRecentMessages(conversation.id, 2);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].content, "msg2");
    assert.strictEqual(recent[1].content, "msg3");
    store.close();
  });

  it("searches messages by query", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation();

    store.storeMessage({ conversationId: conversation.id, role: "user", content: "I like DOOM" });
    store.storeMessage({ conversationId: conversation.id, role: "assistant", content: "DOOM is great" });
    store.storeMessage({ conversationId: conversation.id, role: "user", content: "I like pizza" });

    const results = store.searchMessages("DOOM");
    assert.strictEqual(results.length, 2);
    const contents = results.map((r) => r.message.content).sort();
    assert.deepStrictEqual(contents, ["DOOM is great", "I like DOOM"]);
    store.close();
  });

  it("retrieves relevant conversation history", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation({ topics: ["doom"] });

    store.storeMessage({ conversationId: conversation.id, role: "user", content: "DOOM is awesome" });
    store.storeMessage({ conversationId: conversation.id, role: "assistant", content: "Yes, DOOM is great" });

    const relevant = store.getRelevantConversationHistory("DOOM", 1);
    assert.strictEqual(relevant.length, 1);
    assert.strictEqual(relevant[0].conversation.id, conversation.id);
    assert.strictEqual(relevant[0].messages.length, 2);
    store.close();
  });

  it("keeps multiple conversations isolated", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conv1 = store.createConversation();
    const conv2 = store.createConversation();

    store.storeMessage({ conversationId: conv1.id, role: "user", content: "DOOM" });
    store.storeMessage({ conversationId: conv2.id, role: "user", content: "pizza" });

    const messages1 = store.getMessages(conv1.id);
    const messages2 = store.getMessages(conv2.id);
    assert.strictEqual(messages1.length, 1);
    assert.strictEqual(messages1[0].content, "DOOM");
    assert.strictEqual(messages2.length, 1);
    assert.strictEqual(messages2[0].content, "pizza");
    store.close();
  });

  it("survives process restart", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store1 = new ConversationStore(dbPath);
    const conversation = store1.createConversation();
    store1.storeMessage({ conversationId: conversation.id, role: "user", content: "persistent" });
    store1.close();

    const store2 = new ConversationStore(dbPath);
    const messages = store2.getMessages(conversation.id);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].content, "persistent");
    store2.close();
  });

  it("updates conversation summary", () => {
    const dbPath = `.tmp-tests/conversation-store-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new ConversationStore(dbPath);
    const conversation = store.createConversation();

    store.updateConversationSummary(conversation.id, "DOOM discussion", ["doom", "games"]);
    const updated = store.getConversation(conversation.id);
    assert.strictEqual(updated?.summary, "DOOM discussion");
    assert.deepStrictEqual(updated?.topics, ["doom", "games"]);
    store.close();
  });
});
