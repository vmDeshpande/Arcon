export function buildExtractionPrompt(
  message: string,
): string {
  return `
You are a memory extraction engine.

Extract long-term memories from the user message.

Allowed memory types:

- FACT
- PREFERENCE
- PROJECT
- GOAL
- RELATIONSHIP
- CONSTRAINT

Rules:

- Extract only stable information.
- Extract every independent stable memory in the message.
- Ignore greetings.
- Ignore temporary conversation.
- Return JSON only.
- Return [] if nothing should be remembered.
- If a message introduces a relationship and also gives a fact or preference
  about that entity, return both memories. Do not drop the relationship.
- If the user introduces their own name and gives a preference in the same
  sentence, store the identity relationship and keep the preference on User.

User message:

"${message}"

Example:

Input:
"My dad's name is Milind"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's father is Milind",
    "confidenceScore":0.95
  }
]

Input:
"My dog's name is Murphy and he likes dog food"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's dog is Murphy",
    "confidenceScore":0.95
  },
  {
    "type":"PREFERENCE",
    "content":"Murphy likes dog food",
    "confidenceScore":0.95
  }
]

Input:
"My name is Vedant and I like buttermilk"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's self is Vedant",
    "confidenceScore":0.98
  },
  {
    "type":"PREFERENCE",
    "content":"User likes buttermilk",
    "confidenceScore":0.95
  }
]
`;
}
