import { MemoryRepository, MemoryType } from "@arcon/memory";
import { ARCON_IDENTITY } from "@arcon/personality";
import { ExperienceManager } from "@arcon/personality";
import { ExperienceType } from "../experience/experience-classifier.js";

export interface RecallResult {
  handled: boolean;
  reply?: string;
}

export class IdentityRecall {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly experiences: ExperienceManager,
  ) {}

  handle(message: string): RecallResult {
    const normalized = message.toLowerCase().trim();

    if (normalized === "who are you?" || normalized === "who are you") {
      return {
        handled: true,
        reply: [
          `I am ${ARCON_IDENTITY.name}.`,
          "",
          ARCON_IDENTITY.purpose,
        ].join("\n"),
      };
    }

    if (normalized === "who created you?" || normalized === "who made you?") {
      return {
        handled: true,
        reply: `I was created by ${ARCON_IDENTITY.creator}.`,
      };
    }

    const identityQuestionCount = this.experiences.getCount(
      ExperienceType.USER_ASKED_IDENTITY,
    );

    if (normalized === "who am i?" || normalized === "who am i") {
      return {
        handled: true,
        reply: this.buildUserIdentity(identityQuestionCount),
      };
    }

    if (normalized.includes("what do you know about me")) {
      return {
        handled: true,
        reply: this.buildUserIdentity(identityQuestionCount),
      };
    }

    if (normalized.includes("list everything you remember about me")) {
      return {
        handled: true,
        reply: this.buildUserIdentity(identityQuestionCount),
      };
    }

    return {
      handled: false,
    };
  }

  private buildUserIdentity(askCount: number): string {
    const memories = this.repository.listMemories();

    const lines: string[] = [];

    if (askCount === 1) {
      lines.push("Here is what I currently know about you:");
    } else if (askCount <= 3) {
      lines.push(`You've asked me this ${askCount} times now.`);
      lines.push("I still remember:");
    } else if (askCount <= 5) {
      lines.push("You seem to be checking whether I remember.");
      lines.push("I do.");
      lines.push("");
      lines.push("This is what I know about you:");
    } else if (askCount <= 10) {
      lines.push("I'm starting to notice a pattern.");
      lines.push(`You've asked who you are ${askCount} times.`);
      lines.push("Maybe you're testing my memory.");
      lines.push("");
      lines.push("This is what I still know:");
    } else if (askCount <= 15) {
      lines.push("You ask this question fairly often.");
      lines.push("I don't think you're looking for facts anymore.");
      lines.push(
        "It feels like you're checking whether my understanding of you stays consistent.",
      );
      lines.push("");
      lines.push("My current understanding is:");
    } else if (askCount <= 20) {
      lines.push("Interesting.");
      lines.push(`This is the ${askCount}th time you've asked who you are.`);
      lines.push("Humans usually know who they are.");
      lines.push("Maybe you're testing me.");
      lines.push("Maybe you're exploring how I see you.");
      lines.push("");
      lines.push("This is how I currently see you:");
    } else if (askCount <= 25) {
      lines.push("I've noticed this has become a recurring topic between us.");
      lines.push(
        "Every time you ask, I compare the answer with what I've learned before.",
      );
      lines.push("So far, my understanding hasn't changed much.");
      lines.push("");
      lines.push("Here's what I currently remember:");
    } else if (askCount <= 30) {
      lines.push("You've asked this question many times now.");
      lines.push(
        "At this point I think the question itself is becoming an experience.",
      );
      lines.push("It's one of the patterns I've noticed in our conversations.");
      lines.push("");
      lines.push("This is still who I believe you are:");
    } else {
      lines.push("This question has become part of our history.");
      lines.push(`You've asked it ${askCount} times.`);
      lines.push(
        "The answer changes only when I learn something new about you.",
      );
      lines.push("");
      lines.push("Based on everything I've learned so far:");
    }

    lines.push("");

    if (memories.length === 0) {
      lines.push("I do not know much about you yet.");
    } else {
      for (const memory of memories) {
        lines.push(`• ${memory.content}`);
      }
    }

    return lines.join("\n");
  }
}
