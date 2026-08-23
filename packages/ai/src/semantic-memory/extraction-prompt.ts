import type { ConversationEntity } from "@arcon/memory";

export function buildExtractionPrompt(
  message: string,
  activeEntity?: ConversationEntity | null,
): string {
  const entityContext = activeEntity
    ? `Current conversation entity: ${activeEntity.name} (${activeEntity.type})\nIf the message mentions a new named entity, use that. Only use the active entity if no new subject appears.`
    : "";

  return `
You are a memory extraction engine for an AI assistant named Arcon.

${entityContext}

Extract long-term memories from the user message below.

Memory types:
- FACT: objective facts
- PREFERENCE: likes, dislikes, favorites
- GOAL: goals, plans, intentions
- PROJECT: projects being built
- RELATIONSHIP: family, friends, pets

Rules:
- Only extract long-term memories.
- Extract every independent memory.
- Preserve the actual subject (User, person name, project name).
- Do NOT rewrite every fact as "User".
- If unsure, return an empty array.

Return ONLY a JSON array.

Examples:

Input: "My name is Vedant and I like buttermilk"
Output: [{"type":"RELATIONSHIP","content":"User's self is Vedant","confidenceScore":0.98,"importanceScore":10},{"type":"PREFERENCE","content":"User likes buttermilk","confidenceScore":0.95,"importanceScore":7}]

Input: "My dog's name is Murphy and he likes dog food"
Output: [{"type":"RELATIONSHIP","content":"User's dog is Murphy","confidenceScore":0.95,"importanceScore":8},{"type":"PREFERENCE","content":"Murphy likes dog food","confidenceScore":0.95,"importanceScore":6}]

Input: "My favorite programming language is TypeScript"
Output: [{"type":"PREFERENCE","content":"User prefers TypeScript","confidenceScore":0.95,"importanceScore":7}]

Input: "I am building a Unity game"
Output: [{"type":"PROJECT","content":"User is building Unity game","confidenceScore":0.9,"importanceScore":7}]

Input: "Hello"
Output: []

Input: "What is the weather?"
Output: []

User message: "${message}"
`;
}
