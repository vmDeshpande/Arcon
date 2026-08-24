# Architecture

## Current System

Arcon is a local-first persistent AI companion built on Qwen3-4B + Arcon V1 LoRA.

```text
                    User
                      │
                      ▼
                Web UI / CLI
                      │
                      ▼
           Node.js Arcon Runtime
           (apps/server + packages/*)
                      │
                      ▼
           ChatService Orchestration
                      │
                      ▼
           Intent / Context Understanding
                      │
                      ▼
           Memory Retrieval
           (status + scope + relevance filtering)
                      │
                      ▼
           ContextSnapshot
           (structured internal state)
                      │
                      ▼
           Cognitive Core
           (intent, strategy, uncertainty, clarification)
                      │
                      ▼
           CognitiveDecision
           (structured cognitive output)
                      │
                      ▼
           PromptBuilder
                      │
                      ▼
           Python Inference Service
           (Qwen/Qwen3-4B + Arcon V1 LoRA)
                      │
                      ▼
           Generated Response
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    User Response       Experience Recording
                                ▼
                       Reflection / Consolidation
                       (background, auditable)
                                ▼
                       MemoryPipeline
                       (CREATE / UPDATE / SUPERSEDE / ARCHIVE)
                                ▼
                       Validated Memory
                                ▼
                       future retrieval
```

## Packages

| Package | Responsibility |
|---------|---------------|
| `@arcon/server` | Express server, HTTP endpoints, chat orchestration |
| `@arcon/ai` | ChatService, cognitive core, prompt building, inference provider |
| `@arcon/memory` | SQLite repositories, memory pipeline, retrieval, reflection |
| `@arcon/personality` | Identity, emotions, mood, interests, experiences |
| `@arcon/cognition` | Reasoning engine, intent plugins, strategy plugins |
| `@arcon/shared` | Types, interfaces, event bus |
| `@arcon/logger` | Structured runtime logging |
| `@arcon/voice` | Voice interface layer (STT/TTS) |

## Cognitive Layer

The cognitive layer sits between user input and model generation. It:

1. Understands the user's question (intent classification)
2. Determines which context sources are relevant
3. Retrieves and ranks candidate context (status + scope + relevance filtering)
4. Produces a structured `CognitiveDecision`
5. Selects only relevant information
6. Prepares the final prompt for the model

The model remains responsible for natural-language understanding, reasoning, and response generation. The runtime never returns raw context as a conversational answer.

## Memory System

Short-term conversation history is stored in `ConversationStore` (SQLite). Long-term durable knowledge is stored in `MemoryRepository` (SQLite) and retrieved via `MemoryRetriever`. Memories are extracted semantically by the LLM, validated, normalised, and passed through a review pipeline before storage.

### Memory Lifecycle

Memories have explicit lifecycle states:

- **ACTIVE** — current, valid memory
- **ARCHIVED** — intentionally hidden but preserved
- **OBSOLETE** — outdated information
- **CONTRADICTED** — conflicting information exists
- **PENDING_CONFIRMATION** — awaiting validation
- **SUPERSEDED** — replaced by newer memory (lineage preserved via `supersedesId`)

The memory pipeline enforces these states during retrieval. Stale and invalid memories are excluded from normal retrieval.

## Reflection

Reflection examines accumulated experiences and proposes changes to the existing memory system. Proposals are auditable and always route through `MemoryPipeline`. Reflection never directly bypasses memory lifecycle rules.

## Persistence

All runtime state — conversations, memories, emotions, mood, interests, experiences, entities — is persisted in SQLite files under `data/` or `apps/server/data/`. State survives Node.js restarts.
