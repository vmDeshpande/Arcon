import {
  Memory,
  MemoryStatus
} from "../personal-memory.js";

export function buildMemoryContext(
  memories: Memory[]
): string {
  const relevant = memories
    .filter(
      (memory) =>
        memory.status !== MemoryStatus.ARCHIVED &&
        memory.status !== MemoryStatus.OBSOLETE
    )
    .slice(0, 15);

  if (relevant.length === 0) {
    return "";
  }

  const lines: string[] = [];

  lines.push("Relevant memories:");
  lines.push("");

  for (const memory of relevant) {
    lines.push(`[${memory.type}]`);
    lines.push(memory.content);
    lines.push("");
  }

  return lines.join("\n").trim();
}