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
              Intent Classification
                      │
                      ▼
             Emotion & Experience
                      │
                      ▼
             Interest & Curiosity
                      │
                      ▼
          Semantic Memory Extraction
                      │
                      ▼
            Validation & Normalisation
                      │
                      ▼
             Entity Resolution
                      │
                      ▼
              Knowledge Builder
                      │
                      ▼
               Memory Pipeline
                      │
                      ▼
             Memory Retrieval
                      │
                      ▼
             Prompt Construction
                      │
                      ▼
                    Ollama
                      │
                      ▼
                  Response
```

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
* Ollama integration
* Personal memory repository
* Semantic memory extraction
* Regex fallback extraction
* Memory pipeline
* Memory validation
* Entity graph
* Knowledge builder
* Relationship modelling
* Emotional state
* Mood engine
* Curiosity engine
* Interest engine
* Experience tracking
* Prompt builder
* Context retrieval

---

## 🚧 In Progress

* Better reasoning
* Cognitive orchestration
* Reflection engine
* Improved retrieval
* Internal planning

---

## 📅 Planned

* Reflection
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
* Ollama
* SQLite

Pull a local model:

```bash
ollama pull llama3.2
```

---

## Installation

```bash
git clone https://github.com/vmDeshpande/Arcon.git

cd Arcon

npm install

cp .env.example .env

npm run build

npm start
```

---

## Development

```bash
npm run dev
```

---

# Documentation

Project documentation can be found in the `docs/` directory.

* Architecture
* Design decisions
* Memory engine
* Roadmap

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
