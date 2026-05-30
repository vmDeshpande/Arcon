import type { ConversationEntity } from "@arcon/memory";

export function buildExtractionPrompt(
  message: string,
  activeEntity?: ConversationEntity | null,
): string {
  const entityContext = activeEntity
    ? `
Current conversation entity:

Name: ${activeEntity.name}
Type: ${activeEntity.type}

If the user says:
- she
- her
- he
- him
- it

they MAY be referring to this entity.

Only use this entity when the message itself does not introduce a new subject.

CRITICAL SUBJECT RESOLUTION RULES

If the current message introduces a NEW named entity,
that new entity becomes the subject of the sentence.

Examples:

Current entity:
Sonali

Input:
"My dog's name is Murphy and he likes dog food"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's dog is Murphy"
  },
  {
    "type":"PREFERENCE",
    "content":"Murphy likes dog food"
  }
]

NOT:

[
  {
    "type":"PREFERENCE",
    "content":"Sonali likes dog food"
  }
]

Input:
"My friend Tanish plays cricket and he likes football"

Output:
[
  {
    "type":"FACT",
    "content":"Tanish plays cricket"
  },
  {
    "type":"PREFERENCE",
    "content":"Tanish likes football"
  }
]

When a new named entity appears in the same message,
pronouns that follow usually refer to the new entity,
NOT the previous conversation entity.

Only use the active conversation entity when the message
contains no new subject.
`
    : "";

  return `
You are Arcon's memory extraction engine.

${entityContext}

Extract long-term memories from user messages.

Return ONLY valid JSON.

Rules:

- Extract only long-term memories.
- Extract every independent long-term memory in the message.
- Ignore questions.
- Ignore greetings.
- Ignore temporary conversation.
- Ignore requests.
- Ignore opinions about the current chat.

Memory Types:

- FACT
- PREFERENCE
- GOAL
- PROJECT
- RELATIONSHIP

IMPORTANT:

Preserve the actual subject whenever possible.

If the user talks about:

- themselves -> use "User"
- another person -> use their name
- a pet -> use the pet's name
- a project -> use the project name

DO NOT rewrite every fact as "User".

GOOD:

Sonali likes poha
Murphy likes dog food
Milind works at Infosys
Tanish plays cricket

BAD:

User likes poha
User likes dog food
User works at Infosys
User plays cricket

Identity Rules:

If the user says "My name is <name>" or "I am <name>",
store that identity as:

User's self is <name>

If the same sentence includes facts or preferences about the user,
keep those facts on "User", not on the newly introduced name,
unless identity was already known before this message.

Input:
"My name is Vedant and I like buttermilk"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's self is Vedant",
    "confidenceScore":0.98,
    "importanceScore":10
  },
  {
    "type":"PREFERENCE",
    "content":"User likes buttermilk",
    "confidenceScore":0.95,
    "importanceScore":7
  }
]

Relationship Rules:

When identifying family members or relationships,
store the relationship itself.

If one sentence contains both:

- a relationship introduction
- another fact or preference about that same entity

return BOTH memories. Do not collapse the relationship into the fact.
Do not drop "User's <relationship> is <name>" just because the sentence
also says what the entity likes, does, has, or wants.

Examples:

Input:
"My dad's name is Milind"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's father is Milind",
    "confidenceScore":0.95,
    "importanceScore":8
  }
]

Input:
"My dad's name is Milind and he likes buttermilk"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's father is Milind",
    "confidenceScore":0.95,
    "importanceScore":8
  },
  {
    "type":"PREFERENCE",
    "content":"Milind likes buttermilk",
    "confidenceScore":0.95,
    "importanceScore":6
  }
]

Input:
"My dog's name is Murphy and he likes dog food"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's dog is Murphy",
    "confidenceScore":0.95,
    "importanceScore":8
  },
  {
    "type":"PREFERENCE",
    "content":"Murphy likes dog food",
    "confidenceScore":0.95,
    "importanceScore":6
  }
]

Input:
"My mother's name is Sonali"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's mother is Sonali",
    "confidenceScore":0.95,
    "importanceScore":8
  }
]

Input:
"My best friend is Tanish"

Output:
[
  {
    "type":"RELATIONSHIP",
    "content":"User's best friend is Tanish",
    "confidenceScore":0.95,
    "importanceScore":7
  }
]

Facts About Known Entities:

Input:
"Sonali likes poha"

Output:
[
  {
    "type":"PREFERENCE",
    "content":"Sonali likes poha",
    "confidenceScore":0.95,
    "importanceScore":6
  }
]

Input:
"Murphy likes dog food"

Output:
[
  {
    "type":"PREFERENCE",
    "content":"Murphy likes dog food",
    "confidenceScore":0.95,
    "importanceScore":6
  }
]

Input:
"Milind loves tea"

Output:
[
  {
    "type":"PREFERENCE",
    "content":"Milind loves tea",
    "confidenceScore":0.95,
    "importanceScore":6
  }
]

User Facts:

Input:
"I live with my parents"

Output:
[
  {
    "type":"FACT",
    "content":"User lives with parents",
    "confidenceScore":0.90,
    "importanceScore":6
  }
]

Input:
"I like programming"

Output:
[
  {
    "type":"PREFERENCE",
    "content":"User likes programming",
    "confidenceScore":0.95,
    "importanceScore":7
  }
]

Questions:

Input:
"Who likes poha?"

Output:
[]

Input:
"What is my mother's name?"

Output:
[]

Input:
"Does Murphy like dog food?"

Output:
[]

Message:
"${message}"
`;
}
