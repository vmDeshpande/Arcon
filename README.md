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
![Ollama](https://img.shields.io/badge/Ollama-Local%20LLMs-black)
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

The runtime never returns raw context as a response. The model remains responsible for natural-language understanding, reasoning, and response generation. Runtime systems are responsible for context retrieval, state management, persistence, and cognitive preparation.

---

# Cognitive Systems

## Memory

Arcon separates short-term conversation history from long-term personal memory.

Current capabilities include:

* Personal memory repository
* Semantic memory extraction
* Memory validation
* Confidence scoring
* Importance scoring
* Memory review pipeline
* Conflict detection
* Duplicate detection
* Memory retrieval
* Context building

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

Future systems will use experiences for:

* reflection
* learning
* behavioural adaptation
* long-term growth

---

## Reasoning

Current reasoning consists of specialised recall modules.

Examples:

* Identity recall
* Project recall
* Relationship recall

This is only the beginning.

Future versions will introduce a dedicated reasoning engine capable of forming internal conclusions before generating responses.

---

# Repository Structure

```text
apps/
 ├── chat/
 ├── desktop/
 └── server/

packages/
 ├── ai/
 ├── logger/
 ├── memory/
 ├── personality/
 ├── shared/
 └── voice/

docs/

data/
```

---

# Package Overview

| Package         | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| **ai**          | Chat orchestration, prompt generation, semantic extraction and reasoning |
| **memory**      | Personal memory, retrieval, entity graph and knowledge management        |
| **personality** | Identity, emotions, curiosity, interests, mood and behaviour             |
| **logger**      | Structured runtime logging                                               |
| **shared**      | Shared interfaces and common types                                       |
| **voice**       | Future voice interaction                                                 |

---

# Technology Stack

* TypeScript
* Node.js
* SQLite
* Ollama
* Express
* Better SQLite3

---

# Current Development Status

## ✅ Implemented

* Local chat foundation
* Arcon LoRA inference backend (Qwen3-4B + Arcon V1)
* Personal memory repository
* Semantic memory extraction with think-token handling
* Regex fallback extraction
* Memory pipeline
* Memory validation
* Entity graph
* Knowledge builder
* Relationship modelling
* Emotional state
* Mood engine
* Curiosity engine
* Interest engine (user + Arcon, separated)
* Experience tracking
* Prompt builder
* Context retrieval
* **Cognitive processing layer** (question understanding, context selection, relevance ranking)
* **Context contamination prevention**
* **Conversation persistence across restarts**

---

## 🚧 In Progress

* Better reasoning
* Reflection engine
* Improved retrieval
* Internal planning

---

## 📅 Planned

* Learning from experience
* Goal management
* Planning engine
* Screen awareness
* Computer interaction
* Voice conversation
* Desktop application
* Autonomous workflows
* Multi-agent collaboration

---

# Development Philosophy

Arcon is intentionally developed in phases.

Each subsystem is designed, reviewed and stabilised before becoming part of the larger cognitive architecture.

The goal is **not** to add as many AI features as possible.

The goal is to build systems that can continue evolving for years without becoming unmaintainable.

---

# Getting Started

## Requirements

* Node.js 20+
* npm
* Python 3.11+
* NVIDIA GPU with CUDA (for inference)
* Qwen/Qwen3-4B model (downloaded automatically by transformers)
* Arcon V1 LoRA adapter (included in `training/outputs/arcon-v1/adapter/`)

---

## Installation

```bash
git clone https://github.com/vmDeshpande/Arcon.git

cd Arcon

npm install

cp .env.example .env
```

Build all packages:

```bash
npm run build
```

---

## Running Arcon

Arcon requires two processes:

**Terminal 1 — Python inference service:**

```powershell
# Windows
$env:ARCON_BASE_MODEL = "Qwen/Qwen3-4B"
$env:ARCON_ADAPTER_PATH = "training/outputs/arcon-v1/adapter"
$env:ARCON_ADAPTER_NAME = "arcon-v1"

python services/arcon-inference/main.py
```

```bash
# macOS / Linux
export ARCON_BASE_MODEL="Qwen/Qwen3-4B"
export ARCON_ADAPTER_PATH="training/outputs/arcon-v1/adapter"
export ARCON_ADAPTER_NAME="arcon-v1"

python services/arcon-inference/main.py
```

The inference service listens on `http://127.0.0.1:8000`.

**Terminal 2 — Node.js runtime:**

```powershell
# Windows
$env:ARCON_INFERENCE_BACKEND = "arcon-lora"
$env:ARCON_INFERENCE_BASE_URL = "http://127.0.0.1:8000"
$env:ARCON_ADAPTER_NAME = "arcon-v1"

npm start
```

```bash
# macOS / Linux
export ARCON_INFERENCE_BACKEND="arcon-lora"
export ARCON_INFERENCE_BASE_URL="http://127.0.0.1:8000"
export ARCON_ADAPTER_NAME="arcon-v1"

npm start
```

The Node.js server listens on `http://127.0.0.1:3000` (or `PORT` from `.env`).

---

## Development

```bash
npm run dev
```

---

## Verification

```bash
# Health check
curl http://127.0.0.1:8000/health

# Model info
curl http://127.0.0.1:8000/v1/models

# Chat
curl -X POST http://127.0.0.1:3000/chat -H "Content-Type: application/json" -d "{\"message\":\"Hello Arcon\"}"
```

---

# Documentation

Project documentation can be found in the `docs/` directory.

* Architecture
* Design decisions
* Memory engine
* Roadmap

---

# Cognitive Layer

Arcon now includes a dedicated cognitive processing stage between user input and model generation.

## Question Understanding

Before retrieving context, the `CognitiveProcessor` classifies the user's intent and determines what information is relevant.

Supported intent categories:

* `IDENTITY` — questions about Arcon itself
* `EMOTION` — questions about Arcon's emotional state
* `INTEREST` — questions about Arcon's interests
* `USER_INTEREST` — questions about the user's interests
* `PROJECT` — questions about projects or work
* `MEMORY` — questions about stored memories
* `CONVERSATION` — questions about conversation history
* `GENERAL` — all other questions

## Context Selection

Based on the understood intent, the cognitive layer selects which context sources to include:

* Arcon identity
* Emotional state
* Arcon interests
* User profile / user interests
* Project memories
* Long-term memories
* Recent conversation
* Relevant past conversations

Each intent has strict limits on how much context is retrieved. For example, an identity question does not pull in project memories or unrelated user interests.

## Context Contamination Prevention

The cognitive layer prevents context contamination by:

* Retrieving only memories relevant to the current question
* Limiting the number of memories and conversation turns per intent
* Excluding unrelated topics (e.g., Unity project details from a question about binary search trees)
* Resolving conflicts between old and new information in favor of recency

## Runtime vs Model Responsibility

```text
RUNTIME = context, state, persistence, retrieval, cognition preparation

MODEL = natural-language understanding, reasoning, interpretation, response generation

UI = presentation
```

The runtime prepares focused context. The model generates the response. The runtime never returns raw context as a conversational answer.

---

# Memory System

## Flow

```text
User message
  → Semantic memory extraction (LLM)
  → Validation & normalisation
  → Entity resolution
  → Memory pipeline (create / update / ignore)
  → Persistence (SQLite)
  → Retrieval (on next question)
  → Cognitive context selection
  → PromptBuilder
  → Model generation
```

## Storage

Memories are stored in `data/memories/personal-memory.sqlite`. Each memory has:

* type (FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT)
* status (ACTIVE, ARCHIVED, OBSOLETE, CONTRADICTED, PENDING_CONFIRMATION)
* content
* importance score (1–10)
* confidence score (0–1)
* source type (USER_EXPLICIT, USER_CONFIRMED, INFERRED, SYSTEM_OBSERVED)
* timestamps
* evidence count

## Retrieval

`MemoryRetriever` ranks memories by keyword relevance, importance, confidence, evidence count, and recency. The cognitive layer then selects only the highest-relevance memories for the current question.

## Persistence

Memories persist across Node.js restarts because they are stored in SQLite files, not in-memory state.

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

Emotional state, mood, and interests are persisted in `data/memories/personal-memory.sqlite` and `data/mood.sqlite`.

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

---

# Test Status

## Unit Tests

* `@arcon/ai`: **32/32 passing**
* `@arcon/memory`: **93/93 passing**
* `@arcon/personality`: **44/44 passing**

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

---

# Roadmap

The project is moving toward a complete cognitive architecture.

```text
Foundation
        │
        ▼
Memory
        │
        ▼
Personality
        │
        ▼
Entity Knowledge
        │
        ▼
Reasoning
        │
        ▼
Reflection
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

# Contributing

Contributions are welcome.

Whether you're interested in AI, backend architecture, memory systems, reasoning engines or cognitive modelling, feel free to open an issue or submit a pull request.

Before contributing, please:

* Search existing issues.
* Discuss major architectural changes before implementation.
* Keep modules focused and loosely coupled.
* Prefer small, reviewable pull requests.

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
