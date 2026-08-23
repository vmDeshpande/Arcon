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
                      │
                      ▼
            Cognitive Processing Layer
            ┌─────────────────────────┐
            │ Question Understanding   │
            │ Context Selection        │
            │ Relevance Ranking        │
            │ Conflict Resolution      │
            └─────────────────────────┘
                      │
                      ▼
             PromptBuilder
                      │
                      ▼
           ArconLoRAProvider
                      │
                      ▼
        Python Inference Service
                      │
                      ▼
        Qwen/Qwen3-4B + Arcon V1 LoRA
                      │
                      ▼
           Generated Response
                      │
          ┌────────────┴────────────┐
          ▼                         ▼
   User Response          State Updates
                               ▼
                  Memory / Emotion /
                  Interests / Experiences
                               ▼
                          Persistence
```

## Packages

| Package | Responsibility |
|---------|---------------|
| `@arcon/server` | Express server, HTTP endpoints, chat orchestration |
| `@arcon/ai` | ChatService, cognitive layer, prompt building, inference provider |
| `@arcon/memory` | SQLite repositories, memory pipeline, entity graph, retrieval |
| `@arcon/personality` | Identity, emotions, mood, interests, experiences |
| `@arcon/cognition` | Reasoning engine, intent plugins, strategy plugins |
| `@arcon/shared` | Types, interfaces, event bus |
| `@arcon/logger` | Structured runtime logging |
| `@arcon/voice` | Voice interface layer (STT/TTS) |

## Cognitive Layer

The cognitive layer sits between user input and model generation. It:

1. Understands the user's question (intent classification)
2. Determines which context sources are relevant
3. Retrieves and ranks candidate context
4. Selects only relevant information
5. Prepares the final prompt for the model

The model remains responsible for natural-language understanding, reasoning, and response generation. The runtime never returns raw context as a conversational answer.

## Memory System

Short-term conversation history is stored in `ConversationStore` (SQLite). Long-term durable knowledge is stored in `MemoryRepository` (SQLite) and retrieved via `MemoryRetriever`. Memories are extracted semantically by the LLM, validated, normalised, and passed through a review pipeline before storage.

## Persistence

All runtime state — conversations, memories, emotions, mood, interests, experiences, entities — is persisted in SQLite files under `data/` or `apps/server/data/`. State survives Node.js restarts.
