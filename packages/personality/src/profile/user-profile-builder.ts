import { MemoryRepository } from "@arcon/memory";

export function buildUserProfile(
  repository: MemoryRepository,
): string {
  const memories = repository.listMemories();

  if (memories.length === 0) {
    return "No known information about the user.";
  }

  return [
    "Known information about the user:",
    "",
    ...memories.map(
      (memory) => `- ${memory.content}`,
    ),
  ].join("\n");
}