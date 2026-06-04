import { MemoryRepository, MemoryType } from "@arcon/memory";
import { ARCON_IDENTITY, EmotionManager, ExperienceManager, ExperienceType } from "@arcon/personality";

export interface ProjectRecallResult {
  handled: boolean;
  reply?: string;
}

export class ProjectRecall {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly experiences: ExperienceManager,
    private readonly emotionEngine: EmotionManager,
  ) {}

  handle(message: string): ProjectRecallResult {
    const normalized = message.toLowerCase().trim();

    // Direct Arcon identity questions
    if (normalized === "what is arcon?" || normalized === "what is arcon") {
      return {
        handled: true,
        reply: [
          `I am ${ARCON_IDENTITY.name}.`,
          "",
          ARCON_IDENTITY.purpose,
        ].join("\n"),
      };
    }

    // Questions about current project / what the user is building
    if (
      normalized.includes("what am i building") ||
      normalized.includes("what project am i working on") ||
      normalized.includes("what are we building") ||
      normalized.includes("what do you know about arcon") ||
      normalized.includes("what do you know about the project")
    ) {
      return {
        handled: true,
        reply: this.buildProjectSummary(),
      };
    }

    return { handled: false };
  }

  private buildProjectSummary(): string {
    const projectMemories = this.repository.listMemories({ type: MemoryType.PROJECT });
    const facts = this.repository.listMemories({ type: MemoryType.FACT });

    const arconName = ARCON_IDENTITY.name.toLowerCase();

    const relatedFacts = facts.filter((m) => {
      const contentLower = m.content.toLowerCase();
      const subjectLower = m.subject ? m.subject.toLowerCase() : "";

      return (
        contentLower.includes(arconName) ||
        subjectLower === arconName ||
        contentLower.includes("project") ||
        contentLower.includes("building")
      );
    });

    const lines: string[] = [];

    lines.push(`Here's what I know about projects and building:`);
    lines.push("");

    if (projectMemories.length === 0 && relatedFacts.length === 0) {
      lines.push("I don't have any specific project memories yet.");
      return lines.join("\n");
    }

    if (projectMemories.length > 0) {
      lines.push("Project memories:");
      for (const m of projectMemories) {
        lines.push(`• ${m.content}`);
      }
      lines.push("");
    }

    if (relatedFacts.length > 0) {
      lines.push("Related facts:");
      for (const m of relatedFacts) {
        lines.push(`• ${m.content}`);
      }
    }

    return lines.join("\n");
  }
}
