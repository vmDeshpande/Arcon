# Arcon Personal Memory Engine Design

## Status

Design proposal for Phase 2 review. This document does not define implementation code, migrations, or API endpoints.

## 1. Memory Philosophy

Arcon should not treat every conversation message as a memory. Conversation history records what was said. Personal memory records durable knowledge that may help Arcon understand the user later.

### What Is a Memory?

A memory is a structured, persistent claim about the user, their world, or Arcon's relationship to them.

A memory should be:

- Durable enough to matter beyond the current conversation.
- Specific enough to be useful.
- Traceable to a source.
- Revisable when better information appears.
- Scored by importance and confidence.

Example:

> The user is building Arcon, a local-first AI companion.

This is a memory because it describes a durable project context that should shape future responses.

### What Should Become a Memory?

Information should become memory when it affects future behavior, personalization, prioritization, or interpretation.

Good memory candidates include:

- Stable user facts: name, role, location, skills, constraints.
- Preferences: tooling, communication style, design taste, workflow habits.
- Active projects: goals, architecture decisions, current milestones.
- Important relationships: collaborators, teams, clients, family members if relevant.
- Goals and commitments: things the user wants to achieve or track.
- Recurring patterns: repeated frustrations, repeated preferences, repeated priorities.

### What Should Remain Conversation History?

Some information should remain only in short-term conversation history.

Do not create persistent memory for:

- Casual small talk with no durable value.
- One-off debugging details that are unlikely to matter later.
- Temporary mood or context unless the user asks Arcon to remember it.
- Raw transcripts or long message content.
- Sensitive information unless explicitly useful and appropriate to remember.
- Unverified assumptions made by the model.

Example:

> "Try again with a shorter response."

This may be useful in the current conversation, but should not become a persistent preference unless repeated or explicitly stated as a general preference.

### When Should Memories Be Created?

Memories should be created after a message or interaction contains a durable, useful claim.

Creation should happen when:

- The user explicitly says to remember something.
- The user states a stable fact or preference.
- The user defines or updates a project, goal, or relationship.
- A pattern appears across multiple interactions.
- The system observes a repeated behavior that can be described conservatively.

The memory engine should prefer fewer high-quality memories over many low-value fragments.

### When Should Memories Be Updated?

Existing memories should be updated when new information refines, corrects, supersedes, or strengthens them.

Update instead of creating a duplicate when:

- The same fact is restated with more detail.
- A preference changes.
- A project moves to a new phase.
- A goal is completed, paused, or abandoned.
- Contradictory information appears.
- Repeated evidence increases confidence.

Example:

Old memory:

> The user is working on Arcon Phase 1.

Updated memory:

> The user released Arcon v0.1.0 and is designing the Phase 2 personal memory engine.

## 2. Memory Categories

The memory engine should classify memories into clear categories. Categories make retrieval, ranking, review, and future behavior easier.

### Fact

A fact is a stable statement about the user or their environment.

Examples:

- The user works on Windows.
- The user uses TypeScript for Arcon.
- The Arcon repository is located at `C:\Projects\Arcon`.

Facts should be specific and verifiable where possible.

### Preference

A preference describes how the user likes things to be done.

Examples:

- The user prefers concise technical explanations.
- The user wants Arcon to stay local-first.
- The user prefers modular architecture over tightly coupled features.

Preferences can be explicit or inferred, but inferred preferences should have lower confidence.

### Project

A project memory describes an active or important project, including its scope, status, architecture, or constraints.

Examples:

- Arcon is a local-first AI companion with memory, personality, screen awareness, learning, and computer interaction planned over phases.
- Arcon Phase 1 includes Express, Ollama, SQLite conversation history, logging, and an event bus.
- Future Arcon features should not be implemented before their phase.

Project memories are often among the most useful because they provide durable working context.

### Goal

A goal describes an intended outcome the user wants to reach.

Examples:

- The user wants Arcon to become a persistent digital entity.
- The user wants Phase 2 reviewed as architecture before implementation.
- The user wants memory to scale to thousands of entries.

Goals may have status over time: active, completed, paused, replaced, or abandoned.

### Relationship

A relationship memory describes a person, team, organization, or entity relevant to the user.

Examples:

- A collaborator is responsible for reviewing Arcon memory design.
- A client prefers weekly status reports.
- A family member's birthday matters to the user.

Relationship memories should be handled conservatively because they can involve third-party personal information. The system should store only what is useful, appropriate, and sourced.

## 3. Database Design

The memory database should support thousands of memories, reviewability, retrieval, updates, and future semantic search.

### Proposed `memories` Table

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | text or integer primary key | Stable memory identifier. |
| `type` | text | Category such as `fact`, `preference`, `project`, `goal`, or `relationship`. |
| `content` | text | Human-readable memory statement. |
| `importance_score` | integer | Value from 1-10 indicating how useful the memory is likely to be. |
| `confidence_score` | real | Value from 0-1 or 1-10 indicating how reliable the memory is. |
| `source` | text | Origin of the memory, such as explicit user statement, inference, repeated behavior, import, or system observation. |
| `created_at` | datetime text | When the memory was first created. |
| `updated_at` | datetime text | When the memory was last changed. |

### Recommended Additional Fields

These fields are not required by the prompt, but should be considered before implementation.

| Field | Type | Purpose |
| --- | --- | --- |
| `status` | text | Tracks whether the memory is active, obsolete, contradicted, archived, or pending review. |
| `subject` | text | The entity the memory is about, such as user, project, person, or organization. |
| `tags` | text or separate table | Supports filtering and manual review. |
| `last_used_at` | datetime text | Helps identify stale or frequently useful memories. |
| `use_count` | integer | Tracks retrieval usefulness over time. |
| `evidence_count` | integer | Counts supporting observations or statements. |
| `supersedes_id` | nullable foreign key | Links a new memory to the older memory it replaces. |
| `embedding_id` | nullable text | Allows future vector search without coupling core storage to one embedding provider. |

### Why Each Required Field Exists

`id` gives every memory a stable reference for updates, retrieval logs, review screens, and future memory history.

`type` lets the system apply category-specific rules. A project memory and a preference memory should not be ranked or updated in exactly the same way.

`content` stores the normalized memory statement. It should be concise, direct, and understandable without reading the original conversation.

`importance_score` prevents low-value memories from crowding out critical context.

`confidence_score` prevents weak inferences from being treated like explicit user statements.

`source` makes memories auditable. Arcon should be able to explain why it believes something.

`created_at` supports aging, review, and chronological reasoning.

`updated_at` supports stale-memory detection and sync with future review tools.

## 4. Memory Creation Flow

The memory creation flow should be conservative. The goal is not to extract the maximum number of memories, but to preserve high-value durable information.

```text
User Message
-> Analysis
-> Memory Extraction
-> Memory Validation
-> Memory Storage
```

### User Message

The user sends a normal chat message. The raw message remains part of conversation history.

At this stage, the system should not assume the message contains memory-worthy information.

### Analysis

The system evaluates whether the message contains durable knowledge.

Questions to ask:

- Is this useful outside the current conversation?
- Is it about the user, a project, a goal, a preference, or a relationship?
- Is it explicit, inferred, or ambiguous?
- Is it sensitive?
- Does it update an existing memory?

### Memory Extraction

Candidate memories are extracted as concise claims.

Bad extraction:

> The user talked about lots of Arcon stuff.

Good extraction:

> The user wants Arcon's Phase 2 memory engine designed before implementation.

Each candidate should include proposed type, importance, confidence, source, and related existing memory if any.

### Memory Validation

Validation decides whether a candidate should be stored, updated, ignored, or queued for confirmation.

Validation should reject:

- Trivial details.
- Duplicate memories.
- Overly broad summaries.
- Unsupported assumptions.
- Sensitive claims without clear value.
- Low-confidence inferences that could misrepresent the user.

Some memories should require confirmation, especially relationship or sensitive personal facts.

### Memory Storage

Validated memories are written to the memory store.

Storage should:

- Create new memories only when no existing memory represents the same claim.
- Update existing memories when new information refines them.
- Preserve source and timestamps.
- Record evidence or history for future review.
- Mark contradictions rather than silently overwriting them.

## 5. Memory Retrieval Flow

Memory retrieval should provide the LLM with relevant durable context without flooding the prompt.

```text
User Question
-> Memory Search
-> Ranking
-> Context Injection
-> LLM Response
```

### User Question

The current user message defines the immediate task. Conversation history still handles short-term continuity.

Memory retrieval should be triggered when durable context could improve the answer.

### Memory Search

The system searches memory candidates using a combination of:

- Keyword search.
- Category filters.
- Project or subject filters.
- Recency.
- Future semantic vector search.

Example:

Question:

> What should we do next for Arcon?

Relevant memories may include active project, current phase, roadmap, and user goals.

### Ranking

Search results should be ranked before prompt injection.

Ranking inputs:

- Relevance to the current message.
- Importance score.
- Confidence score.
- Recency.
- Active status.
- Category priority.
- Whether the memory has been useful before.

High-confidence project and goal memories should generally outrank weak inferred preferences.

### Context Injection

Only the top relevant memories should be injected into the LLM context.

Context should be formatted as structured facts, not as hidden instructions that override user intent.

Example:

```text
Relevant memories:
- [project, high confidence] Arcon Phase 1 is complete and v0.1.0 is released.
- [goal, high confidence] The user wants Phase 2 memory architecture reviewed before implementation.
```

The system should keep injected memory compact and traceable.

### LLM Response

The LLM uses the injected memories to answer with better continuity.

The response should not reveal internal scoring unless the user asks. If memory affects a sensitive or uncertain answer, Arcon should phrase conclusions carefully.

## 6. Importance Scoring

Importance should use a 1-10 scale.

The score measures expected future usefulness, not emotional intensity or message length.

| Score | Meaning |
| --- | --- |
| 1-2 | Incidental detail with little future value. |
| 3-4 | Mildly useful context or temporary preference. |
| 5-6 | Useful recurring preference, fact, or project detail. |
| 7-8 | Important active project, goal, constraint, or strong preference. |
| 9-10 | Core identity, major long-term goal, critical constraint, or highly important relationship/context. |

### Examples

Favorite language:

> The user prefers TypeScript.

Suggested score: 6.

Reason: Useful for coding help and project suggestions, but not always relevant.

Current project:

> The user is building Arcon, a local-first AI companion.

Suggested score: 8.

Reason: Strongly relevant across many future conversations.

Temporary preference:

> The user wants a shorter answer in this conversation.

Suggested score: 2 if one-off, 5 if repeated as a general style preference.

Reason: A single local instruction should usually remain conversation context.

Random conversation detail:

> The user mentioned drinking coffee while debugging.

Suggested score: 1.

Reason: Not useful unless the user explicitly asks Arcon to remember it.

Critical constraint:

> Arcon must remain local-first and avoid cloud dependency for core behavior.

Suggested score: 9.

Reason: This affects architecture decisions and should shape future recommendations.

## 7. Confidence Scoring

Confidence should represent how reliable the memory is.

A 0-1 scale is recommended for computation, while review tools may display it as a percentage.

| Confidence | Meaning |
| --- | --- |
| 0.0-0.2 | Very weak inference or uncertain interpretation. |
| 0.3-0.5 | Plausible but not confirmed. |
| 0.6-0.7 | Reasonable inference or indirectly supported claim. |
| 0.8-0.9 | Explicitly stated by user or strongly repeated pattern. |
| 1.0 | Directly confirmed by user as something to remember. |

### Examples

Explicitly stated by user:

> "Remember that I prefer TypeScript."

Suggested confidence: 1.0.

Reason: Direct instruction to remember.

Inferred from behavior:

> The user repeatedly asks for TypeScript examples.

Suggested confidence: 0.6.

Reason: Useful inference, but the user may simply be working in a TypeScript codebase.

Repeated multiple times:

> The user repeatedly says Arcon should stay local-first.

Suggested confidence: 0.9.

Reason: Repetition strongly supports the memory.

Contradictory information:

Old memory:

> The user prefers JavaScript.

New statement:

> "I prefer TypeScript now."

Suggested confidence for old memory: reduce or mark obsolete.

Suggested confidence for new memory: 0.8-1.0 depending on phrasing.

Reason: New explicit statements should supersede older stale memories, but history should remain available.

## 8. Memory Updates

Memory should be mutable, but not carelessly overwritten.

### How Memories Change

Memories can change through:

- Refinement: adding more precise information.
- Reinforcement: increasing confidence after repeated evidence.
- Status change: active to completed, paused, obsolete, or archived.
- Correction: replacing an inaccurate claim.
- Merge: combining duplicate or overlapping memories.

Example refinement:

Old:

> The user is working on Arcon.

New:

> The user is designing Arcon Phase 2's personal memory engine after releasing v0.1.0.

### Contradictions

Contradictions should be detected before storage.

When new information conflicts with existing memory:

- Keep the old memory for history.
- Mark the old memory as contradicted, obsolete, or superseded.
- Create or update the new active memory.
- Link the records through `supersedes_id` or a memory history table.
- Prefer explicit recent user statements over old inferred memories.

The system should ask for clarification when both claims are important and confidence is similar.

### Obsolete Memories

Obsolete memories should not be deleted by default.

They should be excluded from normal retrieval unless:

- The user asks about history.
- The obsolete memory explains a prior decision.
- The system is performing reflection or cleanup.

Examples:

- A completed project phase.
- A replaced technical preference.
- A past goal that no longer applies.

### Memory History

Memory history should preserve how a memory evolved.

Recommended history data:

- Memory id.
- Previous content.
- New content.
- Change reason.
- Source interaction.
- Timestamp.
- Confidence and importance before and after.

History supports auditability, debugging, user review, and future reflection.

## 9. Future Expansion

The memory engine should remain small in Phase 2, but its design should support later systems.

### Personality System

The personality system can use memory to adapt tone and behavior to the user.

Examples:

- The user prefers direct technical critique.
- The user values local-first architecture.
- The user does not want future-phase features implemented prematurely.

Memory should inform personality, but personality should not rewrite memory facts.

### Curiosity Engine

A curiosity engine can identify missing or stale information.

Examples:

- A project memory exists without a current status.
- A goal has not been updated in months.
- A preference is low confidence and worth confirming.

The memory engine supports this through confidence, updated dates, status, and source metadata.

### Reflection Engine

A reflection engine can periodically consolidate memory.

Examples:

- Merge duplicate memories.
- Promote repeated short-term patterns into durable memories.
- Lower confidence for stale inferred memories.
- Archive obsolete project details.

Reflection should produce proposed changes that are auditable and reversible.

### Proactive Conversations

Proactive behavior can use memory to decide when an interruption or suggestion is useful.

Examples:

- Remind the user about an active goal.
- Ask whether a stale project is still active.
- Suggest next steps based on a remembered roadmap.

The memory engine should expose active goals, high-importance project memories, and stale-but-important memories for this purpose.

### Web Learning

Future web learning can attach external evidence to memories.

Examples:

- Project documentation found online.
- Public API changes relevant to a user's project.
- Research sources connected to a goal.

External memories should track source type, URL or citation, retrieval date, and confidence separately from user-stated memories. User-stated personal facts should remain higher authority than web-inferred claims about the user.

## Review Questions Before Implementation

Before coding Phase 2, the project should decide:

- Whether confidence uses 0-1 or 1-10 internally.
- Whether memory ids are UUIDs or SQLite integer ids.
- Whether memory history is required in the first implementation.
- Whether embeddings are included in Phase 2 or deferred.
- Whether sensitive memories require explicit user confirmation.
- How users can inspect, edit, and delete memories later.

## Phase 2.1 Implementation

Phase 2.1 implements only the Memory Data Layer. It does not implement memory extraction, prompt retrieval, ranking, embeddings, semantic search, API endpoints, or chat integration.

### Package Structure

The storage layer lives in `packages/memory`.

```text
packages/memory/
  src/
    conversation-memory.ts   # Phase 1 short-term conversation history
    personal-memory.ts       # Phase 2.1 persistent memory data layer
    index.ts                 # Public exports
  tests/
    memory-repository.test.ts
```

The existing conversation memory remains separate from personal memory. This prevents Phase 2.1 from changing chat behavior while still allowing future phases to build on the new repository.

### Memory Enums

The implementation defines these memory categories:

- `FACT`
- `PREFERENCE`
- `PROJECT`
- `GOAL`
- `RELATIONSHIP`
- `CONSTRAINT`

Memory status values:

- `ACTIVE`
- `ARCHIVED`
- `OBSOLETE`
- `CONTRADICTED`
- `PENDING_CONFIRMATION`

Source type values:

- `USER_EXPLICIT`
- `USER_CONFIRMED`
- `INFERRED`
- `SYSTEM_OBSERVED`

### Schema

Phase 2.1 creates a dedicated SQLite table named `personal_memories`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | UUID generated by the repository. |
| `type` | `TEXT NOT NULL` | Checked against supported memory types. |
| `status` | `TEXT NOT NULL` | Checked against supported memory statuses. |
| `content` | `TEXT NOT NULL` | Normalized memory statement. |
| `importance_score` | `INTEGER NOT NULL` | Must be from 1 to 10. |
| `confidence_score` | `REAL NOT NULL` | Must be from 0 to 1. |
| `source_type` | `TEXT NOT NULL` | Checked against supported source types. |
| `created_at` | `TEXT NOT NULL` | ISO timestamp when created. |
| `updated_at` | `TEXT NOT NULL` | ISO timestamp when last changed. |
| `subject` | `TEXT` | Optional memory subject, such as a project or person. |
| `tags` | `TEXT NOT NULL` | JSON-encoded string array. |
| `evidence_count` | `INTEGER NOT NULL` | Non-negative count of supporting evidence. |
| `last_used_at` | `TEXT` | Reserved for future retrieval tracking. |
| `supersedes_id` | `TEXT` | Optional link to an older memory. |

Indexes:

- `type`
- `status`
- `(type, status)`
- `subject`
- `updated_at`

These indexes support filtering and future review tools without adding vector search or embedding tables.

### Repository Methods

`MemoryRepository` provides:

- `createMemory(input)` creates, validates, stores, and returns a memory.
- `getMemoryById(id)` returns a memory or `null`.
- `updateMemory(id, input)` validates and updates a memory, returning the updated memory or `null`.
- `archiveMemory(id)` sets status to `ARCHIVED`.
- `deleteMemory(id)` permanently deletes a memory and returns whether a row was removed.
- `listMemories(filter)` lists memories, optionally filtered by `type`, `status`, or both.

The repository uses `better-sqlite3` and creates its table and indexes automatically when constructed.

### Validation Rules

The data layer rejects invalid records before writing them.

Rules:

- `content` cannot be empty after trimming.
- `importanceScore` must be an integer from 1 to 10.
- `confidenceScore` must be a finite number from 0 to 1.
- `type` must be one of the supported memory types.
- `status` must be one of the supported memory statuses.
- `sourceType` must be one of the supported source types.
- `evidenceCount` must be a non-negative integer.
- `tags` are trimmed, empty tags are removed, and duplicates are removed.

Validation failures throw `MemoryValidationError`.

### Test Coverage

Phase 2.1 tests cover:

- Memory creation and readback.
- Memory updates.
- Archive flow.
- Delete flow.
- Filtering by type and status.
- Validation failures for empty content, invalid importance, and invalid confidence.

Tests run without Ollama, the Express server, or chat integration.

## Phase 2.2 Implementation

Phase 2.2 implements the Memory Extraction Engine. It analyzes user messages and extracts potential memory candidates using pattern matching.

**Important: This phase does NOT persist memories to the database.** It only produces structured candidate objects that can be validated and reviewed later.

### Package Structure

The extraction engine lives in `packages/memory/src/extractor/`.

```text
packages/memory/
  src/
    conversation-memory.ts          # Phase 1
    personal-memory.ts              # Phase 2.1 data layer
    extractor/
      ├── memory-extractor.ts       # Main extraction engine
      ├── candidate.ts              # MemoryCandidate interface
      ├── rules.ts                  # Pattern-based extraction rules
      └── index.ts                  # Public exports
    index.ts                        # Exports everything
  tests/
    memory-extractor.test.ts        # Comprehensive extraction tests
```

### MemoryCandidate Interface

`MemoryCandidate` is the primary output of the extraction engine:

```typescript
interface MemoryCandidate {
  type: MemoryType;                 // FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT
  content: string;                  // Normalized memory statement
  confidenceScore: number;          // 0.0 - 1.0
  importanceScore: number;          // 1 - 10
  sourceType: MemorySourceType;     // USER_EXPLICIT, USER_CONFIRMED, INFERRED, SYSTEM_OBSERVED
  reasoning: string;                // Why this candidate was extracted (for debugging)
}
```

The `reasoning` field documents the pattern that triggered extraction. Examples:
- "Explicit favorite statement"
- "Explicit preference statement"
- "Like statement indicating preference"
- "User explicitly states they use something"

### Extraction Rules

The engine uses deterministic pattern matching, not AI or embeddings. Each memory type has dedicated extraction rules.

#### Preference Extraction

Patterns matched:
- "My favorite X is Y" → 0.95 confidence
- "I prefer X" → 0.9 confidence
- "I like X" / "I really like X" → 0.85 confidence
- "I don't like X" / "I dislike X" → 0.9 confidence

Example:
```
Input: "My favorite language is TypeScript"
Output: {
  type: PREFERENCE,
  content: "User's favorite language is TypeScript",
  confidenceScore: 0.95,
  importanceScore: 6,
  sourceType: USER_EXPLICIT,
  reasoning: "Explicit favorite statement"
}
```

#### Fact Extraction

Patterns matched:
- "I use X" → 0.9 confidence
- "I work with X" → 0.9 confidence
- "I am [profession/status]" → 0.85 confidence
- "I have X" → 0.85 confidence

The engine rejects ambiguous statements like "I am here" or "I am ready".

Example:
```
Input: "I use Windows 11"
Output: {
  type: FACT,
  content: "User uses Windows 11",
  confidenceScore: 0.9,
  importanceScore: 5,
  sourceType: USER_EXPLICIT,
  reasoning: "User explicitly states they use something"
}
```

#### Project Extraction

Patterns matched:
- "I am building X" / "I'm building X" → 0.95 confidence
- "I am working on X" / "I'm working on X" → 0.95 confidence
- "I am creating X" / "I'm creating X" → 0.95 confidence
- "I am developing X" / "I'm developing X" → 0.95 confidence
- Supports "currently" modifier

Example:
```
Input: "I am building Arcon"
Output: {
  type: PROJECT,
  content: "User is building Arcon",
  confidenceScore: 0.95,
  importanceScore: 8,
  sourceType: USER_EXPLICIT,
  reasoning: "Explicit statement about current project"
}
```

#### Goal Extraction

Patterns matched:
- "My goal is X" → 0.95 confidence
- "I want to X" → 0.8 confidence
- "I aim to X" → 0.9 confidence
- "I need to X" / "I should X" → 0.75 confidence

Example:
```
Input: "My goal is to build a local-first AI companion"
Output: {
  type: GOAL,
  content: "User's goal is to build a local-first AI companion",
  confidenceScore: 0.95,
  importanceScore: 8,
  sourceType: USER_EXPLICIT,
  reasoning: "Explicit goal statement"
}
```

#### Constraint Extraction

Patterns matched:
- "X must Y" → 0.95 confidence
- "X can't Y" / "X cannot Y" → 0.95 confidence
- "X should only Y" → 0.9 confidence

Example:
```
Input: "Arcon must remain local-first"
Output: {
  type: CONSTRAINT,
  content: "Arcon must remain local-first",
  confidenceScore: 0.95,
  importanceScore: 9,
  sourceType: USER_EXPLICIT,
  reasoning: "Explicit constraint with must"
}
```

#### Relationship Extraction

Patterns matched:
- "X works with me" / "X works with [entity]" → 0.9 confidence
- "X wants to contribute to Y" → 0.9 confidence
- "X and I are/both Y" → 0.8 confidence
- "X is my [role]" → 0.95 confidence

Example:
```
Input: "Vicky Gupta wants to contribute to Arcon"
Output: {
  type: RELATIONSHIP,
  content: "Vicky Gupta wants to contribute to Arcon",
  confidenceScore: 0.9,
  importanceScore: 7,
  sourceType: USER_EXPLICIT,
  reasoning: "Explicit statement about collaborative relationship"
}
```

### Importance Scoring

Default importance by type:
- FACT: 5
- PREFERENCE: 6
- PROJECT: 8
- GOAL: 8
- RELATIONSHIP: 7
- CONSTRAINT: 9

These defaults reflect the guidelines in Section 6 of this document.

### Validation Rules

Messages are validated before extraction:
- Message must be a non-empty string
- Message must be at least 10 characters (configurable)
- Message must not exceed 5000 characters (configurable)

Invalid messages return validation errors without any candidates.

### Duplicate Prevention

The engine deduplicates candidates using:
1. **Exact matching**: Identical content after normalization
2. **Type matching**: Same memory type
3. **Substring matching**: One content string includes another
4. **Fuzzy matching**: 80%+ similarity using Levenshtein distance

When duplicates are found:
- The candidate with higher confidence is kept
- Lower confidence candidates are tracked in the `duplicates` array
- The `DuplicateCandidate` object includes the removal reason

### ExtractionResult

The `extract()` method returns:

```typescript
interface ExtractionResult {
  candidates: MemoryCandidate[];           // Unique, valid candidates
  duplicates: DuplicateCandidate[];        // Filtered-out candidates with reasons
  validationErrors: string[];              // Input validation failures
}
```

### API Usage

Basic usage:

```typescript
import { MemoryExtractor } from "@arcon/memory";

const extractor = new MemoryExtractor();

const result = extractor.extract(
  "My favorite language is TypeScript and I'm building Arcon"
);

console.log(result.candidates);    // MemoryCandidate[]
console.log(result.duplicates);    // DuplicateCandidate[]
console.log(result.validationErrors); // string[]
```

Custom configuration:

```typescript
const extractor = new MemoryExtractor({
  minMessageLength: 5,
  maxMessageLength: 10000
});
```

### Test Coverage

Comprehensive tests in `tests/memory-extractor.test.ts` cover:

- **Preference extraction**: favorite, prefer, like, dislike
- **Fact extraction**: use, work with, am, have
- **Project extraction**: building, working on, creating, developing
- **Goal extraction**: goal is, want to, aim to, need to
- **Constraint extraction**: must, can't, cannot, should only
- **Relationship extraction**: works with, wants to contribute, is my role
- **Duplicate prevention**: exact duplicates, similar content, higher confidence
- **Validation**: empty messages, too short, too long
- **Confidence and importance scoring**: correct defaults by type
- **Multiple extraction**: extracting multiple types from one message
- **Reasoning documentation**: all candidates have explanations
- **Custom configuration**: respecting configuration options
- **Real-world examples**: complex multi-claim messages

### What's NOT Included

This phase explicitly excludes:
- Database writes (candidates are not persisted)
- Memory repository integration
- Chat integration
- Automatic memory saving
- Memory retrieval
- Ranking or filtering for use
- Embeddings or vector search
- Reflection or consolidation
- Personality system integration
- Ollama or AI-based classification

These will be implemented in later phases.
