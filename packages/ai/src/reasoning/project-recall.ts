import { MemoryRepository, MemoryType } from "@arcon/memory";
import { ARCON_IDENTITY } from "@arcon/personality";
import type { ProjectContext } from "./context-types.js";

export class ProjectRecall {
  constructor(
    private readonly repository: MemoryRepository,
  ) {}

  handle(message: string): ProjectContext {
    const normalized = message.toLowerCase().trim();

    const isProjectQuestion =
      normalized.includes("what am i building") ||
      normalized.includes("what project am i working on") ||
      normalized.includes("what are we building") ||
      normalized.includes("what do you know about arcon") ||
      normalized.includes("what do you know about the project") ||
      normalized.includes("what is my current project") ||
      normalized.includes("what project") ||
      normalized.includes("what are we working on");

    const isArconQuestion =
      normalized === "what is arcon?" ||
      normalized === "what is arcon";

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

    return {
      isProjectQuestion,
      isArconQuestion,
      projects: projectMemories.map((m) => ({ content: m.content, type: m.type })),
      relatedFacts: relatedFacts.map((m) => ({ content: m.content })),
    };
  }
}