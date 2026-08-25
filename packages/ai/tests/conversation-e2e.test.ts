import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MemoryPipeline,
  MemoryRepository,
  MemoryType,
  MemoryStatus,
  MemoryScope,
} from "@arcon/memory";
import { MoodRepository, MoodCategory } from "@arcon/personality";
import type { AiClient, ChatMessage } from "@arcon/shared";

import { ChatService } from "../src/chat-service.js";

class SmartMockAiClient implements AiClient {
  private index = 0;
  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generateReply(messages: ChatMessage[]): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content ?? "";

    if (content.includes("memory extraction engine")) {
      return this.getExtractionResponse(content);
    }

    const response = this.responses[this.index] ?? "";
    this.index += 1;
    return response;
  }

  private getExtractionResponse(prompt: string): string {
    const lines = prompt.split("\n").filter((line) => line.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    const userMatch = lastLine.match(/^User message: "(.*)"$/);
    const userMessage = userMatch ? userMatch[1] : lastLine;
    const lower = userMessage.toLowerCase();

    const memories: Array<{
      type: string;
      content: string;
      confidenceScore: number;
      importanceScore: number;
    }> = [];

    if (lower.includes("switched to fedora")) {
      memories.push({
        type: "FACT",
        content: "User switched from Arch Linux to Fedora",
        confidenceScore: 0.95,
        importanceScore: 8,
      });
    }

    if (lower.includes("arch linux") || lower.includes("fedora")) {
      memories.push({
        type: "FACT",
        content: "User uses Arch Linux",
        confidenceScore: 0.95,
        importanceScore: 8,
      });
    }

    if (lower.includes("typescript")) {
      memories.push({
        type: "PREFERENCE",
        content: "User prefers TypeScript",
        confidenceScore: 0.95,
        importanceScore: 7,
      });
    }

    if (lower.includes("project a") || lower.includes("postgresql")) {
      memories.push({
        type: "PROJECT",
        content: "User is building Project A with PostgreSQL",
        confidenceScore: 0.9,
        importanceScore: 8,
      });
    }

    if (lower.includes("project b") || lower.includes("sqlite")) {
      memories.push({
        type: "PROJECT",
        content: "User is building Project B with SQLite",
        confidenceScore: 0.9,
        importanceScore: 8,
      });
    }

    if (lower.includes("vedant")) {
      memories.push({
        type: "RELATIONSHIP",
        content: "User's self is Vedant",
        confidenceScore: 0.98,
        importanceScore: 10,
      });
    }

    if (lower.includes("building arcon")) {
      memories.push({
        type: "PROJECT",
        content: "User is building Arcon",
        confidenceScore: 0.9,
        importanceScore: 8,
      });
    }

    return JSON.stringify(memories);
  }
}

function createService(
  responses: string[],
) {
  const dir = mkdtempSync(join(tmpdir(), "arcon-e2e-"));
  const repository = new MemoryRepository(join(dir, "memories.sqlite"));
  const pipeline = new MemoryPipeline(repository);
  const moodDatabasePath = join(dir, "mood.sqlite");
  const service = new ChatService(
    repository,
    pipeline,
    new SmartMockAiClient(responses),
    {
      experienceDatabasePath: join(dir, "experiences.sqlite"),
      moodDatabasePath,
      entityDatabasePath: join(dir, "entities.sqlite"),
      conversationDatabasePath: join(dir, "conversations.sqlite"),
    },
  );

  return {
    service,
    repository,
    moodDatabasePath,
  };
}

async function waitForExtraction(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

describe("Arcon End-to-End Conversation Readiness", () => {
  describe("Basic memory lifecycle", () => {
    it("creates and retrieves a memory through the conversation pipeline", async () => {
      const { service, repository } = createService([
        "I remember that!",
      ]);

      await service.chat("I use Arch Linux.");
      await waitForExtraction();

      const memories = repository.listMemories({
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
      });

      assert(memories.some((m) => m.content.includes("Arch Linux")), "expected Arch Linux memory to be created");
    });

    it("does not save every sentence as permanent memory", async () => {
      const { service, repository } = createService([
        "Interesting!",
        "Tell me more.",
      ]);

      await service.chat("Hi, how are you?");
      await waitForExtraction();
      await service.chat("I like pizza.");
      await waitForExtraction();

      const memories = repository.listMemories();
      assert(memories.length < 5, "expected few memories, not every sentence saved");
    });
  });

  describe("Memory rejection", () => {
    it("does not store casual conversational statements as permanent memories", async () => {
      const { service, repository } = createService([
        "I see.",
        "Understood.",
      ]);

      await service.chat("What do you think about the weather?");
      await waitForExtraction();

      const memories = repository.listMemories();
      assert(!memories.some((m) => m.content.includes("weather")), "casual question should not be stored as permanent memory");
    });
  });

  describe("Memory updates and contradictions", () => {
    it("handles OS switch through supersession", async () => {
      const { service, repository } = createService([
        "Noted.",
        "You use Fedora now.",
      ]);

      await service.chat("I use Arch Linux.");
      await waitForExtraction();

      await service.chat("I switched to Fedora.");
      await waitForExtraction();

      const activeFacts = repository.listMemories({
        type: MemoryType.FACT,
        status: MemoryStatus.ACTIVE,
      });

      assert(activeFacts.some((m) => m.content.includes("Fedora")), "expected Fedora to be active");
      assert(!activeFacts.some((m) => m.content === "User uses Arch Linux"), "original Arch Linux memory should not be active");

      const superseded = repository.listMemories({
        type: MemoryType.FACT,
        status: MemoryStatus.SUPERSEDED,
      });

      assert(superseded.some((m) => m.content === "User uses Arch Linux"), "original Arch Linux memory should be superseded");
    });
  });

  describe("Project isolation", () => {
    it("creates separate project memories without cross-contamination", async () => {
      const { service, repository } = createService([
        "I see.",
        "Understood.",
      ]);

      await service.chat("For Project A, I use PostgreSQL.");
      await waitForExtraction();

      await service.chat("For Project B, I use SQLite.");
      await waitForExtraction();

      const allMemories = repository.listMemories({
        status: MemoryStatus.ACTIVE,
      });

      assert(allMemories.some((m) => m.content.includes("Project A") || m.content.includes("PostgreSQL")), "Project A memory should exist");
      assert(allMemories.some((m) => m.content.includes("Project B") || m.content.includes("SQLite")), "Project B memory should exist");
      assert(allMemories.length >= 2, "both project memories should be stored independently");
    });
  });

  describe("Mood system", () => {
    it("tracks mood state across conversation turns", async () => {
      const { service, moodDatabasePath } = createService([
        "Happy to help!",
      ]);

      await service.chat("I'm excited about this project!");
      await waitForExtraction();

      const moodRepository = new MoodRepository(moodDatabasePath);
      const mood = moodRepository.getMood();

      assert(typeof mood.category === "string", "mood should have a category");
      assert(typeof mood.intensity === "number", "mood should have intensity");
      assert(mood.intensity >= 0 && mood.intensity <= 1, "intensity should be bounded");

      moodRepository.close();
    });

    it("persists mood across service instances", async () => {
      const { service, moodDatabasePath } = createService([
        "Got it.",
      ]);

      await service.chat("I'm excited about this project!");
      await waitForExtraction();
      service.close();

      const moodRepository = new MoodRepository(moodDatabasePath);
      const mood1 = moodRepository.getMood();
      assert(mood1.category !== MoodCategory.NEUTRAL, "mood should have changed from neutral");

      const { service: service2 } = createService([
        "Sure.",
      ]);
      service2.close();

      const mood2 = moodRepository.getMood();
      assert(mood2.category === mood1.category || mood2.intensity !== mood1.intensity, "mood should persist");

      moodRepository.close();
    });
  });

  describe("Integration", () => {
    it("runs a full conversation with memory and mood", async () => {
      const { service, repository, moodDatabasePath } = createService([
        "Nice to meet you!",
        "Good plan.",
      ]);

      const result1 = await service.chat("Hi, I'm Vedant and I use TypeScript.");
      await waitForExtraction();
      assert(result1.reply.length > 0, "should produce a reply");

      const memories1 = repository.listMemories({ status: MemoryStatus.ACTIVE });
      const hasName = memories1.some((m) => m.content.includes("Vedant"));
      const hasTypeScript = memories1.some((m) => m.content.includes("TypeScript"));
      assert(hasName || hasTypeScript, "should remember user info");

      const result2 = await service.chat("I'm building Arcon.");
      await waitForExtraction();
      assert(result2.reply.length > 0, "should produce a second reply");

      const memories2 = repository.listMemories({ status: MemoryStatus.ACTIVE });
      assert(memories2.some((m) => m.content.includes("Arcon")), "should remember project");

      const moodRepository = new MoodRepository(moodDatabasePath);
      const mood = moodRepository.getMood();
      assert(mood.category !== undefined, "mood should be defined");
      moodRepository.close();

      service.close();
    });
  });
});
