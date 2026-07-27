# Arcon Phase 3 — Cognitive Core

> **Status:** Planned
>
> **Objective:** Transform Arcon from a collection of intelligent systems into a unified cognitive architecture capable of internal reasoning before responding.

---

# Philosophy

Until Phase 2, Arcon has successfully built the foundations of cognition:

- Personal Memory
- Entity Knowledge
- Personality
- Emotion
- Mood
- Curiosity
- Experience
- Semantic Memory
- Prompt Generation

These systems work independently and provide valuable information.

However, they are not yet unified.

Currently, Arcon behaves like this:

```text
User
   │
   ▼
Memory
Emotion
Experience
Curiosity
Intent
   │
   ▼
Prompt
   │
   ▼
LLM
```

Every subsystem contributes directly to prompt generation.

There is no internal representation of Arcon's understanding.

Phase 3 changes that.

---

# Goal

Introduce a **Cognitive Layer** that sits between every subsystem and the language model.

Instead of directly generating prompts, every subsystem contributes structured knowledge to a shared object called a **Thought**.

```text
User
   │
   ▼
Memory
Emotion
Experience
Entity Knowledge
Curiosity
Reasoning
   │
   ▼
Thought
   │
   ▼
Prompt Builder
   │
   ▼
LLM
```

The LLM should no longer perform Arcon's thinking.

The LLM should only express the conclusions already reached by Arcon's cognitive systems.

---

# Guiding Principles

## 1. Structured Cognition

Every subsystem returns structured data.

Never prompt strings.

Examples:

Memory

```ts
Memory[]
```

Emotion

```ts
MoodState
```

Reasoning

```ts
Thought
```

Planning

```ts
Plan
```

Reflection

```ts
Reflection
```

---

## 2. Single Prompt Boundary

Only one component may communicate with the language model.

```text
Prompt Builder
```

No other subsystem should build prompts or call the LLM directly.

---

## 3. Independent Cognitive Systems

Every module should have one responsibility.

Memory stores knowledge.

Emotion tracks emotional state.

Reflection learns.

Reasoning thinks.

Planning decides.

Prompt Builder communicates.

---

# Phase Overview

```text
Phase 3
│
├── 3.1 Thought Model
├── 3.2 Reasoning Engine
├── 3.3 Prompt Refactor
├── 3.4 Reflection Engine
├── 3.5 Belief System
├── 3.6 Goal System
├── 3.7 Planning Engine
└── 3.8 Internal Dialogue
```

Each phase builds on the previous one.

---

# Phase 3.1 — Thought Model

## Goal

Create Arcon's internal language.

Every subsystem will contribute to a single object called **Thought**.

Instead of passing strings around the project, everything becomes structured.

---

## New Package

```text
packages/
    cognition/
```

---

## Initial Structure

```text
packages/cognition/

├── package.json
├── tsconfig.json

└── src

    ├── index.ts

    ├── thought/
    │
    │   ├── thought.ts
    │   └── thought-builder.ts

    ├── reasoning/
    │
    │   └── reasoning-engine.ts

    └── types/
        └── reasoning.ts
```

---

## Step 1

Create the package.

No functionality.

Only project structure.

---

## Step 2

Design the Thought model.

The Thought object becomes the centre of Arcon's cognition.

Example:

```text
Thought

├── User Intent
├── Relevant Memories
├── Relevant Entities
├── Emotional Context
├── Experiences
├── Curiosity
├── Assumptions
├── Conclusions
└── Reply Strategy
```

This object should remain completely independent of prompts.

---

## Step 3

Create Thought Builder.

The builder combines outputs from every subsystem into one coherent Thought.

It performs no reasoning.

Only composition.

---

## Step 4

Create Reasoning Engine.

Initially the engine is intentionally simple.

```text
Input

↓

Thought Builder

↓

Thought
```

Reasoning logic will be added gradually.

---

## Step 5

Create shared reasoning types.

Examples:

- Reply Style
- Confidence
- Question Type
- Reason Priority
- Decision Type

These become shared enums across the entire project.

---

## Step 6

Export everything through the package.

The package should now compile without changing any existing code.

---

# Phase 3.2 — Reasoning Engine

## Goal

Replace specialised recall systems with genuine reasoning.

Current:

```text
Identity Recall

Relationship Recall

Project Recall
```

Future:

```text
Question

↓

Retrieve memories

↓

Retrieve entities

↓

Retrieve experiences

↓

Evaluate emotions

↓

Resolve contradictions

↓

Generate Thought
```

The engine should never produce English.

It only produces structured cognition.

---

# Phase 3.3 — Prompt Refactor

Current:

```text
Identity Prompt

Behaviour Prompt

Relationship Prompt

Memory Context

↓

Join Strings

↓

LLM
```

Future:

```text
Thought

↓

Prompt Builder

↓

LLM
```

Prompt Builder becomes a translator rather than a decision maker.

---

# Phase 3.4 — Reflection Engine

## Goal

Teach Arcon to learn from experience.

Memory stores facts.

Reflection produces understanding.

Example:

Experience

```text
The user corrected me three times today.
```

Reflection

```text
I should become more cautious when answering this user.
```

Reflection changes behaviour.

Memory preserves history.

---

# Phase 3.5 — Belief System

Beliefs are derived from memories.

Memory

```text
User prefers TypeScript.
```

Belief

```text
The user values strongly typed ecosystems.
```

Beliefs should never be extracted directly.

They emerge over time.

---

# Phase 3.6 — Goal System

Introduce persistent goals.

Examples:

- User goals
- Arcon goals
- Active goals
- Completed goals
- Deferred goals

Goals become first-class cognitive objects.

---

# Phase 3.7 — Planning Engine

Planning converts goals into actions.

```text
Goal

↓

Plan

↓

Steps

↓

Execution
```

Planning should never execute actions itself.

It only produces plans.

---

# Phase 3.8 — Internal Dialogue

Before replying, Arcon should internally think.

Example:

```text
User asks question

↓

What are they asking?

↓

Which memories matter?

↓

What entities are involved?

↓

How confident am I?

↓

Should I ask for clarification?

↓

Construct Thought

↓

Generate response
```

This internal reasoning remains structured.

Not prompt text.

---

# Future After Phase 3

Only after the Cognitive Core is complete should development continue with:

- Screen Awareness
- Voice
- Desktop Application
- Browser Automation
- Computer Control
- Workflow Execution
- Multi-Agent Collaboration

These systems should rely on the Cognitive Core rather than bypass it.

---

# Success Criteria

Phase 3 is complete when:

- Every cognitive subsystem returns structured data.
- Thought becomes the shared language between systems.
- Prompt Builder is the only LLM interface.
- Reasoning no longer returns replies.
- Reflection begins modifying future behaviour.
- ChatService becomes a lightweight orchestrator.

---

# Long-Term Vision

The Cognitive Core is the point where Arcon stops behaving like an assistant with memory and starts behaving like a persistent digital mind.

Memory remembers.

Emotion feels.

Experience records.

Reflection learns.

Reasoning understands.

Planning decides.

The language model simply communicates those conclusions.