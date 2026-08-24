# Arcon

> **A local-first cognitive architecture for building a persistent digital companion.**
>
> Arcon is not designed to be "just another AI assistant." It is an attempt to build a digital entity that can remember, learn, develop relationships, maintain a sense of identity, and eventually reason, reflect, and interact with the world over long periods of time.

> **⚠️ Project Status**
>
> Arcon is under active development and its architecture is evolving rapidly. While many core cognitive systems already exist, the project is **not production-ready** and breaking changes should be expected.

---

<p align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)
![SQLite](https://img.shields.io/badge/SQLite-Database-blue)
![Status](https://img.shields.io/badge/Status-Active%20Development-orange)
![License](https://img.shields.io/github/license/vmDeshpande/Arcon)
![GitHub stars](https://img.shields.io/github/stars/vmDeshpande/Arcon)

</p>

---

# Why Arcon?

Most AI assistants forget everything once the conversation ends.

Some assistants remember information, but they still behave like stateless chatbots with a memory database attached.

Humans don't work that way.

People develop:

* identity
* experiences
* relationships
* interests
* emotions
* long-term goals
* understanding

Those systems continuously influence how we think before we speak.

**Arcon is an experiment in building those systems as independent architectural components instead of hiding everything inside a prompt.**

---

# Vision

The long-term vision of Arcon is to create a persistent digital companion capable of:

* 🧠 Long-term personal memory
* ❤️ Emotional modelling
* 👤 Identity and personality
* 🤝 Relationship awareness
* 📚 Learning from experience
* 🔍 Curiosity-driven conversations
* 💭 Internal reasoning
* 🪞 Reflection and self-improvement
* 🖥️ Computer interaction
* 🌍 Local-first operation

Rather than becoming a better chatbot, Arcon aims to become a **better thinker**.

---

# Design Philosophy

Arcon follows a few fundamental principles.

## Local First

Everything important should work without cloud services.

The user owns their data.

No core behaviour should depend on remote APIs.

---

## Modular Cognition

Memory should not know about emotions.

Emotions should not know about prompt generation.

Prompt generation should not know how memories are stored.

Every cognitive system should have one clear responsibility.

---

## Explainable Behaviour

Arcon should know *why* it remembers something.

Every memory has:

* source
* confidence
* importance
* timestamps
* status
* evidence count

Knowledge should always be auditable.

---

## Memory is Knowledge

Conversation history is not memory.

Memory represents durable knowledge that changes future behaviour.

Example:

Conversation:

> "Can you make the answer shorter?"

Memory:

> The user prefers concise technical explanations.

Those are very different things.

---

# Current Architecture

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

The runtime never returns raw context as a response. The model remains responsible for natural-language understanding, reasoning, and response generation. Runtime systems are responsible for context retrieval, state management, persistence, and cognitive preparation.

---

# Cognitive Systems

## Memory

Arcon separates short-term conversation history from long-term personal memory.

Memory lifecycle states:

* **ACTIVE** — current, valid memory
* **ARCHIVED** — intentionally hidden but preserved
* **OBSOLETE** — outdated information
* **CONTRADICTED** — conflicting information exists
* **PENDING_CONFIRMATION** — awaiting validation
* **SUPERSEDED** — replaced by newer memory (lineage preserved via `supersedesId`)

Current capabilities include:

* Personal memory repository (SQLite)
* Memory pipeline with lifecycle enforcement
* Semantic memory extraction (LLM + regex fallback)
* Memory validation and normalisation
* Confidence scoring (0.0–1.0)
* Importance scoring (1–10)
* Conflict detection
* Duplicate detection
* Scope-based access control
* Supersession with lineage preservation
* Selective retrieval with relevance threshold
* Context building via `ContextSnapshot`

---

## Entity System

Instead of storing isolated memories, Arcon builds structured knowledge.

```text
Entity
   │
   ├── Facts
   ├── Relationships
   ├── Evidence
   └── Linked Memories
```

This allows future reasoning to operate on knowledge rather than raw text.

---

## Personality

Personality is treated as a collection of independent systems.

Current components include:

* Identity
* Behaviour modelling
* Emotional state
* Mood
* Curiosity
* Interests
* Experiences
* Relationship profiles

These systems influence behaviour without replacing the language model.

---

## Emotion

Arcon maintains a lightweight emotional model.

Examples include:

* Curiosity
* Trust
* Excitement
* Frustration

These values evolve over time and influence behaviour naturally rather than through hardcoded responses.

---

## Experience

Events are stored as experiences rather than discarded.

Current capabilities include:

* Experience counting by type
* Context/provenance tracking
* Background reflection trigger
* Pattern detection for preferences, projects, relationships, and frustration
* Proposals for memory changes through the existing lifecycle

---

## Cognitive Core

Arcon now includes a dedicated cognitive processing stage between user input and model generation.

### Question Understanding

Before retrieving context, the cognitive layer classifies the user's intent and determines what information is relevant.

Supported intent categories:

* `IDENTITY` — questions about Arcon itself
* `EMOTION` — questions about Arcon's emotional state
* `INTEREST` — questions about Arcon's interests
* `USER_INTEREST` — questions about the user's interests
* `PROJECT` — questions about projects or work
* `MEMORY` — questions about stored memories
* `CONVERSATION` — questions about conversation history
* `GENERAL` — all other questions

### Structured Cognitive Decisions

The cognitive layer produces `CognitiveDecision` objects containing:

* `thought` — internal reasoning summary (not exposed to user)
* `decision` — type, confidence, reason
* `strategy` / `strategyReason` — response approach
* `tone` — conversational tone
* `clarificationNeeded` — whether more information is required
* `responseMode` — how to construct the response
* `requiredContext` — what context is missing
* `unresolvedConflicts` — contradictions needing handling
* `stages` — processing stage metadata

### Clarification Routing

When context is insufficient, the cognitive layer can request clarification without invoking full answer generation.

### Runtime Identity Grounding

The system prompt includes a `RUNTIME CAPABILITIES:` section grounded in actual runtime state (SQLite-backed memory, no web search/tools).

---

## Reasoning

Current reasoning consists of structured cognitive decisions and processing stages.

Examples:

* Intent classification
* Context selection
* Strategy determination
* Clarification needs
* Conflict resolution

Future versions will introduce a dedicated reasoning engine capable of forming internal conclusions before generating responses.

---

## Reflection

Reflection examines accumulated experiences and proposes changes to the existing memory system.

```text
Experience
  ↓
ReflectionEngine
  ↓
ReflectionCandidate (with evidence/provenance)
  ↓
ReflectionProcessor
  ↓
MemoryPipeline
  ↓
Validated memory change
```

Key principles:

* Reflection proposes; MemoryPipeline decides
* Every proposal retains evidence (experience type, count, timestamps, context)
* Weak evidence does not create strong persistent memories
* Reflection runs asynchronously without blocking chat
* Historical memory is preserved; supersession maintains lineage

---

# Repository Structure

```text
apps/
 ├── server/           # Canonical Express runtime
 └── desktop/          # Desktop UI (out of scope)

packages/
 ├── ai/               # Chat orchestration, cognitive core, prompt building, inference
 ├── cognition/        # Reasoning engine, intent plugins, strategy plugins
 ├── logger/           # Structured runtime logging
 ├── memory/           # SQLite repositories, memory pipeline, retrieval, reflection
 ├── personality/      # Identity, emotions, mood, interests, experiences
 ├── shared/           # Shared interfaces and common types
 └── voice/            # Voice interface layer (STT/TTS)

services/
 └── arcon-inference/  # Python FastAPI inference service

training/              # LoRA/QLoRA training scripts and datasets

docs/                  # Architecture, design decisions, specifications
```

---

# Package Overview

| Package | Responsibility |
|---------|---------------|
| **ai** | Chat orchestration, cognitive core, prompt generation, inference provider |
| **cognition** | Reasoning engine, intent plugins, strategy plugins |
| **memory** | SQLite repositories, memory pipeline, retrieval, reflection, entity graph |
| **personality** | Identity, emotions, mood, interests, experiences |
| **logger** | Structured runtime logging |
| **shared** | Shared interfaces and common types |
| **voice** | Voice interface layer (STT/TTS) |

---

# Technology Stack

* TypeScript
* Node.js
* Python 3.11+
* SQLite (better-sqlite3)
* Qwen/Qwen3-4B + LoRA
* Express
* FastAPI (inference service)

---

# Current Development Status

## ✅ Implemented

* Local chat foundation (canonical Express runtime)
* Arcon LoRA inference backend (Qwen3-4B + Arcon V1)
* Personal memory repository with lifecycle states
* Semantic memory extraction with think-token handling
* Regex fallback extraction
* Memory pipeline (CREATE / UPDATE / SUPERSEDE / ARCHIVE / IGNORE / CONFLICT)
* Memory validation and normalisation
* Entity graph
* Knowledge builder
* Relationship modelling
* Emotional state
* Mood engine
* Curiosity engine
* Interest engine (user + Arcon, separated)
* Experience tracking with provenance
* **ContextSnapshot** — structured internal state for context
* **CognitiveDecision** — structured cognitive output
* **Cognitive Core** — intent classification, strategy, clarification routing
* **Context contamination prevention**
* **Supersession with lineage preservation**
* **Memory scope enforcement**
* **Reflection and consolidation** — background, auditable, through MemoryPipeline
* **Clarification questions** when context is insufficient
* **Runtime identity/capability grounding**
* **Conversation persistence across restarts**

---

## 🚧 In Progress

* Better reasoning (structured cognitive decisions exist; deeper reasoning in progress)
* Improved retrieval (semantic vector search deferred)
* Goal management
* Planning engine

---

## 📅 Planned

* Learning from experience (reflection exists; deeper learning patterns planned)
* Screen awareness
* Computer interaction
* Voice conversation (interface layer exists; full integration planned)
* Desktop application
* Autonomous workflows
* Multi-agent collaboration
* Semantic vector search
* Memory decay engine
* Automatic memory merge
* Proactive conversations

---

# Memory System

## Flow

```text
User message
  → Semantic memory extraction (LLM)
  → Validation & normalisation
  → Entity resolution
  → Memory pipeline (create / update / supersede / archive / ignore / conflict)
  → Persistence (SQLite)
  → Retrieval (on next question)
  → Cognitive context selection
  → ContextSnapshot
  → PromptBuilder
  → Model generation
```

## Storage

Memories are stored in SQLite files. Each memory has:

* type (FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT)
* status (ACTIVE, ARCHIVED, OBSOLETE, CONTRADICTED, PENDING_CONFIRMATION, SUPERSEDED)
* content
* importance score (1–10)
* confidence score (0–1)
* source type (USER_EXPLICIT, USER_CONFIRMED, INFERRED, SYSTEM_OBSERVED)
* scope (USER, ARCON, PROJECT, ENTITY, CONVERSATION)
* timestamps
* evidence count
* supersedes_id (lineage link)

## Retrieval

`MemoryRetriever` applies SQL-level prefiltering by status and scope, then ranks memories by keyword relevance, importance, confidence, evidence count, and recency. An explicit relevance threshold excludes weak matches. The cognitive layer then selects only the highest-relevance memories for the current question.

## Persistence

All runtime state — conversations, memories, emotions, mood, interests, experiences, entities — is persisted in SQLite files under `data/` or `apps/server/data/`. State survives Node.js restarts.

---

# Emotion / Mood / Interests

## EmotionManager

Tracks emotional dimensions: curiosity, trust, happiness, confidence, frustration. Values evolve from user and assistant events.

## MoodEngine

Derives a mood label from the current emotional state and tracks behaviour metadata such as ask count and pending questions.

## InterestEngine

Maintains two separate interest stores:

* **User interests** — learned from user messages
* **Arcon interests** — learned from Arcon's own responses

**Important:** Arcon's assistant replies are not fed back into the user-interest engine. This prevents Arcon from incorrectly treating its own statements as user preferences.

## Persistence

Emotional state, mood, and interests are persisted in SQLite files.

---

# Model / Inference Setup

## Current Model

* **Base model:** Qwen/Qwen3-4B
* **Adapter:** Arcon V1 LoRA (rank 8, alpha 16, dropout 0.05, NF4 quantisation)
* **Inference:** Python FastAPI service (`services/arcon-inference/`)
* **Runtime:** Node.js (`apps/server/`)

## Inference Service

The Python service loads the base model and LoRA adapter and exposes an OpenAI-compatible `/v1/chat/completions` endpoint.

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCON_BASE_MODEL` | `Qwen/Qwen3-4B` | Hugging Face model ID |
| `ARCON_ADAPTER_PATH` | `""` | Path to LoRA adapter directory |
| `ARCON_ADAPTER_NAME` | `""` | Adapter name for metadata |
| `ARCON_INFERENCE_HOST` | `127.0.0.1` | Bind host |
| `ARCON_INFERENCE_PORT` | `8000` | Bind port |
| `ARCON_MAX_NEW_TOKENS` | `512` | Max generation length |
| `ARCON_TEMPERATURE` | `0.7` | Sampling temperature |
| `ARCON_TOP_P` | `0.9` | Top-p sampling |
| `ARCON_REPETITION_PENALTY` | `1.1` | Repetition penalty |

## Node.js Runtime

The Node.js server connects to the inference service via `ARCON_INFERENCE_BASE_URL` and routes all generation through `ArconLoRAProvider`.

## Model Artifacts

The trained LoRA adapter weights (`adapter_model.safetensors`) are large generated files and are not committed to Git. The repository includes the training code and adapter configuration needed to reproduce them.

---

# Current Limitations

## Model-Side Memory Under-Use

Memory retrieval, persistence, and context selection are all verified working. However, Qwen3-4B occasionally under-uses a retrieved long-term memory even when the memory was successfully retrieved and supplied to the model. The model may defer to conversation context or express caution rather than stating a stored fact directly. This is a model-behaviour limitation, not a memory-system failure.

## Other Verified Limitations

* The cognitive layer uses rule-based intent classification; it does not use the model for question understanding.
* Context selection is deterministic per intent category; it does not dynamically rank individual memories by semantic similarity to the question.
* The system requires a CUDA-enabled GPU for inference.
* The model occasionally outputs `<think>` tokens, which are stripped before display but may affect generation quality.
* No semantic vector search is implemented.
* Reflection pattern detection is conservative and does not use LLM-based synthesis.
* No memory decay or automatic merge is implemented.

---

# Test Status

## Unit Tests

* `@arcon/ai`: **32/32 passing** (includes cognitive core tests)
* `@arcon/memory`: **93/93 passing** (includes reflection tests)
* `@arcon/personality`: **44/44 passing**
* `@arcon/cognition`: **43/43 passing**
* `@arcon/voice`: **40/40 passing**

## Verified Integration Behaviour

* Identity questions return correct self-description
* Memory storage (e.g., "My favorite programming language is TypeScript") persists correctly
* Memory retrieval returns stored information on subsequent questions
* Project storage and recall work across conversation turns
* Context contamination is prevented (unrelated questions receive pure technical answers)
* Topic switching works cleanly
* Returning to previous topics recalls earlier context correctly
* Restart persistence survives Node.js server restarts
* Clarification questions are asked when context is insufficient
* Supersession preserves historical lineage
* Reflection proposals route through MemoryPipeline with evidence

---

# Roadmap

The project is moving toward a complete cognitive architecture.

```text
Foundation
        │
        ▼
Memory (Phase B — COMPLETE)
        │
        ▼
Personality
        │
        ▼
Entity Knowledge
        │
        ▼
Retrieval + Context Selection (Phase C — COMPLETE)
        │
        ▼
Cognitive Core (Phase D — COMPLETE)
        │
        ▼
Reflection + Consolidation (Phase E — COMPLETE)
        │
        ▼
Reasoning
        │
        ▼
Planning
        │
        ▼
Computer Interaction
        │
        ▼
Persistent Digital Companion
```

---

# Documentation

Project documentation can be found in the `docs/` directory.

* [Architecture](docs/architecture.md)
* [Architecture audit 2026-08-24](docs/ARCON_ARCHITECTURE_AUDIT_2026-08-24.md)
* [Design decisions](docs/decisions.md)
* [Memory engine](docs/memory-engine.md)
* [Roadmap](docs/roadmap.md)
* [Cognitive specification](docs/arcon-cognitive-specification.md)
* [Training specification](docs/arcon-training-specification.md)
* [Dataset design](docs/arcon-dataset-design.md)
* [Evaluation specification](docs/arcon-evaluation-specification.md)

Community and contribution documentation:

* [Contributing](CONTRIBUTING.md)
* [Code of Conduct](CODE_OF_CONDUCT.md)
* [Security policy](SECURITY.md)
* [Support](SUPPORT.md)
* [Changelog](CHANGELOG.md)

---

# License

Arcon is licensed under the [Apache License, Version 2.0](LICENSE).

---

# Contributing

Contributions are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or submitting a pull request.

Whether you're interested in AI, backend architecture, memory systems, reasoning engines or cognitive modelling, feel free to open an issue or submit a pull request.

---

# Inspiration

Arcon is inspired by research and ideas from:

* Cognitive architectures
* Human memory systems
* Knowledge graphs
* Local AI
* Persistent digital companions
* Long-term autonomous agents

The project is not intended to replicate any existing assistant, but to explore a different architectural approach to building persistent AI systems.

---

# Long-Term Goal

The end goal is not simply to answer questions.

The end goal is to build a digital entity capable of:

* remembering meaningful experiences,
* developing a consistent identity,
* understanding relationships,
* learning from interactions,
* reasoning before responding,
* reflecting on its own knowledge,
* and growing alongside its user over time.

---

<p align="center">
<b>Arcon is an exploration into what happens when memory, identity, emotion, and reasoning are treated as first-class software systems—not just prompt engineering.</b>
</p>
