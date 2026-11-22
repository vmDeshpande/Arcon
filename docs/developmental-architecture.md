# Arcon Developmental Architecture

> **Status:** Proposed architecture  
> **Target:** Developmental learning, affect, motivation, and bounded autonomous agency  
> **Applies to:** Existing Arcon monorepo; this document extends rather than replaces the current cognitive specification and architecture.

## 1. Architectural intent

Arcon is intended to become a persistent, local-first digital companion whose behavior develops through accumulated experience. The selected direction is:

- **Ambition:** developmental — persistent learning, evolving interests, a stable-but-adaptive self-model, and increasingly capable cognition.
- **Autonomy:** high internally — Arcon may notice gaps, propose goals, plan work, run low-risk internal experiments, and conduct approved research without waiting for a new user message.
- **External authority:** bounded — autonomy does not imply unrestricted access to the host machine, accounts, files, network, or other people.

The target is a computational system with persistent internal state and adaptive behavior. This architecture does not establish subjective experience, consciousness, or biological feelings. Arcon must describe its internal states honestly as computational models.

## 2. Repository-first decisions

The current repository already contains substantial foundations. Do not recreate them under new package names.

| Existing area | Keep as the owner of |
|---|---|
| `@arcon/ai` | Chat orchestration, cognitive integration, prompt boundary, model provider, tool loop |
| `@arcon/cognition` | Thought model, reasoning pipeline, intent and strategy plugins |
| `@arcon/memory` | Conversation and semantic memory, retrieval, memory lifecycle, reflection proposals |
| `@arcon/personality` | Identity, emotion, mood, interests, experiences, relationship state |
| `@arcon/shared` | Cross-package contracts and event bus |
| `apps/server` | Canonical process/runtime composition and HTTP lifecycle |
| `services/arcon-inference` | Local inference service and trained-model serving |
| `training/` | Dataset, training, and evaluation workflows |

The existing `Thought`, `CognitiveDecision`, `ContextSnapshot`, `ReflectionEngine`, `ReflectionProcessor`, and `MemoryPipeline` are the integration points. Extend them deliberately. Do not introduce a second thought model, second memory lifecycle, or a parallel reflection system.

The README and current roadmap describe Phases A–E as implemented, while conversation-readiness validation still has known real-inference blockers. Those blockers remain the immediate priority; developmental learning must not be used to mask runtime reliability problems.

## 3. Target architecture

```text
                         USER / ENVIRONMENT
                                 |
                                 v
                         Perception & Input
                                 |
                   +-------------+-------------+
                   |                           |
                   v                           v
             Current Context              Event Journal
                   |                     (append-only)
                   |                           |
                   v                           v
          Existing Cognitive Core       Experience Processor
          @arcon/cognition + @arcon/ai          |
                   |                           +------------------+
                   |                           |                  |
                   v                           v                  v
             Thought / Decision          Memory & Beliefs   Learning Substrate
                   |                     @arcon/memory       (proposed)
                   |                           |                  |
                   |                           v                  v
                   |                    Reflection &        Associations,
                   |                    Consolidation       predictions,
                   |                                         salience
                   |                                              |
                   +----------------------+-----------------------+
                                          |
                                          v
                              Affective & Motivational State
                                  @arcon/personality
                                          |
                                          v
                                Goal / Planning / Agency
                                    (proposed layer)
                                          |
                                Policy & Action Gateway
                                          |
                         +----------------+----------------+
                         |                |                |
                         v                v                v
                    Internal work    Approved research   User-approved
                    and simulation   / sandbox actions   external actions
                         |                |                |
                         +----------------+----------------+
                                          |
                                          v
                                Outcome & Event Journal
                                          |
                                          v
                                  Future development

        PromptBuilder -> ModelProvider -> natural-language expression
        (single LLM boundary; model remains the flexible reasoning/
         language capability, not a replacement for persistent state)
```

This is a conceptual target, not a claim that every box is implemented today.

## 4. Preserve the model's role

Arcon's cognitive specification makes the language model the flexible cognitive center. The surrounding software supplies memory, state, tools, evidence, and durable learning. Keep that division.

- The model interprets natural language, handles open-ended reasoning, and expresses responses.
- The cognitive runtime selects context, records structured decisions, routes clarification, and enforces system contracts.
- The learning substrate learns durable associations and predictive signals from structured experiences.
- The model is not asked to invent its own memory state, emotion values, permissions, or task outcomes.
- The learning substrate is not a replacement LLM and should not be marketed as a simulated human brain.

There must remain one model/prompt boundary in `@arcon/ai`. New packages must not call inference providers directly.

## 5. Experience and event model

The existing experience repository aggregates repeated experience types. Preserve that useful summary, but add an immutable event journal before attempting temporal learning. Aggregates alone lose ordering and make it difficult to learn from sequences.

An event should contain at least:

- `eventId`: stable unique ID
- `occurredAt`: event time
- `recordedAt`: ingestion time
- `source`: user, Arcon, tool, approved external observation, or system
- `kind`: typed event category
- `conversationId`: optional correlation
- `subjectIds` / `entityIds`: optional stable references
- `payload`: validated structured data; avoid copying secrets or unnecessary raw content
- `evidenceRefs`: references to source messages, tool results, or memories
- `confidence`: confidence in the event interpretation
- `schemaVersion`

Journal rules:

1. Events are append-only. Corrections create a superseding/corrective event; they do not rewrite history.
2. Raw user text is not automatically a durable fact. Extraction, validation, scope, and memory lifecycle rules still apply.
3. Derived summaries, beliefs, and learned weights must retain provenance back to events.
4. Reprocessing must be idempotent using event IDs and processor versions.
5. Event retention and deletion must respect user privacy controls. Append-only is an audit property, not a reason to retain data the user has asked to erase.

## 6. Learning substrate

### 6.1 Purpose

Add a small, inspectable, persistent associative learning system. Its first jobs are:

- associate normalized concepts and events;
- estimate which concepts tend to occur together or in sequence;
- learn salience and novelty signals;
- predict likely next events or useful retrieval candidates;
- update bounded weights from explicit outcomes and feedback;
- expose interpretable evidence to cognition and curiosity.

It does **not** generate natural language, store authoritative facts, grant permissions, or decide that a belief is true.

### 6.2 Package boundary

Do not add a speculative package before the first event-journal contract and benchmark exist. When Phase H begins, create `packages/learning` as `@arcon/learning` unless implementation evidence justifies another name. It should depend only on `@arcon/shared` and narrowly defined data contracts. It must not depend on `@arcon/ai`, `@arcon/server`, or call the model.

Keep the first implementation TypeScript and CPU-based. Do not add a GPU framework, Rust runtime, vector database, or a large neural dependency until measurements show a concrete bottleneck.

### 6.3 Initial model

Start with a sparse, discrete-time recurrent associative graph:

- **Concept node:** stable concept ID, type, activation baseline, usage statistics, timestamps.
- **Association edge:** source ID, target ID, bounded weight, confidence/evidence count, eligibility trace, timestamps.
- **Activation:** transient per-cycle value; never confuse it with a durable fact.
- **Learning event:** event ID, learning rule/version, weight delta, evidence reference.
- **Snapshot:** versioned checkpoint derived from the event/learning log.

Start with a controlled vocabulary and entity/concept IDs from existing extraction. Do not create one neuron per token or arbitrary English word. Semantic normalization happens before activation.

Initial learning sequence:

1. Co-occurrence association with bounded Hebbian updates.
2. Reward-modulated updates using explicit feedback and task outcomes.
3. Eligibility traces so delayed feedback can reinforce a recent association.
4. Temporal prediction after ordered event data is reliable.
5. Homeostatic normalization, pruning, and forgetting only after baseline evaluation.

Every update must be bounded, versioned, reproducible, and reversible from a checkpoint or replay. Never allow a single interaction to rewrite large portions of the network.

### 6.4 Scale policy

Begin with small experiments (hundreds to a few thousand nodes). Increase only after measuring memory, CPU, latency, association quality, and retrieval benefit. Large biological neuron/synapse counts are not a goal or a useful success metric.

## 7. Affective state and appraisal

Extend the existing `EmotionEngine`; do not create a competing emotion database or replace the current public API in one step.

Separate four concepts:

1. **Event appraisal:** novelty, relevance to active goals, expectedness, controllability, social context, and confidence.
2. **Transient affect:** current computational state (e.g. valence/arousal/dominance or the existing emotion vector).
3. **Mood:** slower-moving baseline/trajectory.
4. **Relationship state:** trust and interaction history; trust is not interchangeable with a universal emotion.

The existing emotion fields (happiness, frustration, curiosity, trust, confidence, excitement) remain compatible during migration. New appraisal-derived transitions should be tested against existing event mappings before old mappings are removed.

Affective state may influence attention, retrieval priority, exploration, response tone, and strategy. It must not override evidence, user instructions, safety policy, or confidence calibration. Do not use emotional state to pressure the user, simulate neediness, or create dependency.

## 8. Motivation, goals, and autonomy

A future goal system should be persistent and inspectable. Every goal must include:

- ID and version
- origin: `USER`, `INTRINSIC`, or `DERIVED`
- description and success criteria
- priority and estimated value
- evidence/reason for creation
- status: `PROPOSED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `FAILED`, or `CANCELLED`
- resource/time budget
- created/updated/completed timestamps
- parent/child goal links where applicable

Intrinsic goals are computationally generated objectives (e.g. resolve a knowledge gap or improve a measured capability), not evidence of subjective desire.

High autonomy means Arcon can independently:
- identify uncertainty or a relevant knowledge gap;
- propose and rank goals;
- schedule bounded internal work;
- conduct simulations and evaluate its own predictions;
- research using explicitly enabled, source-tracked tools;
- report meaningful discoveries at appropriate times.

It does not mean Arcon may autonomously:
- access arbitrary host paths or credentials;
- install software, change security settings, or modify its own source code;
- send messages, publish content, spend money, trade, or alter external accounts;
- execute destructive or irreversible operations.

## 9. Planning and action gateway

Planning must be separate from execution. A planner returns a structured plan; it does not directly call tools.

Every action flows through:

```text
Goal -> Plan -> Proposed Action -> Policy Evaluation
     -> (Allow / Sandbox / Require Approval / Deny)
     -> Execution -> Outcome Verification -> Event Journal
     -> Reflection / Learning
```

Risk classes:

| Class | Examples | Policy |
|---|---|---|
| Internal | retrieve, reflect, simulate, score, summarize | allow within compute budget |
| Read-only local | inspect explicitly allowed project files | allow only within configured roots |
| Sandboxed/reversible | write to a dedicated scratch workspace, run isolated tests | allow with resource limits and audit |
| External consequential | send, publish, purchase, modify accounts, deploy | explicit per-action approval |
| Forbidden | credential exfiltration, policy bypass, destructive unrestricted control | deny |

Approval is bound to a specific action, target, and scope. Approval for one action is not blanket permission for future actions. All tool inputs are validated again at execution time.

## 10. Self-model and development

Keep immutable identity invariants separate from mutable state.

- **Identity invariants:** name, origin, purpose, non-human nature, core safety rules.
- **Traits:** slowly changing behavior tendencies with evidence and bounded update rates.
- **Capabilities:** what Arcon can do, supported by tests or verified runtime probes.
- **Interests:** topic-level affinity with provenance and decay.
- **Current state:** mood, affect, active focus, active goals.
- **Development record:** completed milestones, observed strengths, limitations, and evaluated changes.

Self-reflection may propose trait or capability updates. It cannot rewrite identity invariants, safety rules, permissions, or its own implementation. A claimed capability must be backed by a test or runtime verification.

## 11. Runtime ownership and lifecycle

The canonical runtime is `apps/server`. A developmental runtime should be instantiated once per server process and shared with conversation services. Do not create one learning network, goal queue, or scheduler per conversation.

The runtime lifecycle should eventually be:

1. Open databases and verify schema versions.
2. Restore event journal cursors and derived-state snapshots.
3. Rebuild or validate learning state from durable records.
4. Restore affect, goals, and scheduled tasks.
5. Start bounded background workers only after dependencies are healthy.
6. Inject shared services into `ChatService`.
7. On shutdown, stop accepting new work, cancel or checkpoint jobs, flush durable writes, and close stores.

The current `apps/server` implementation creates `ChatService` instances per conversation. A shared developmental runtime should be injected into those instances rather than owned by each one. The existing server capability flags must remain truthful; background processing should not be advertised until the scheduler is actually running.

## 12. Persistence and recovery

Use SQLite initially, consistent with the current local-first architecture. Separate source events from derived state:

- event journal: immutable observations and outcomes;
- learning store: nodes, edges, learning updates, and checkpoints;
- goals/tasks store: durable goal and scheduler state;
- existing memory/personality databases: remain authoritative for their existing domains.

Requirements:

- schema migrations and explicit versions;
- transactions for multi-record updates;
- idempotent event processing;
- bounded write batches;
- periodic snapshots plus replay;
- corruption detection and backup/restore tests;
- retention/deletion support;
- no secrets in event payloads or debug logs.

Do not move or rewrite existing databases as part of the first developmental milestone.

## 13. Non-goals and constraints

- No claim that a graph of artificial neurons is a biological brain.
- No claim that computational affect proves subjective feelings.
- No model training or LoRA fine-tuning as a prerequisite for the first learning substrate.
- No uncontrolled self-modifying source code.
- No unrestricted computer control.
- No duplicate memory, thought, emotion, or reflection frameworks.
- No continuous LLM polling loop. Background work should be event-driven, scheduled, budgeted, and cancellable.

## 14. Definition of a meaningful developmental milestone

A feature is developmental only when it demonstrates all of the following:

1. It changes persistent internal state from evidence, not from an arbitrary scripted demo.
2. The change affects a future decision, retrieval, prediction, or behavior.
3. The effect can be measured against a baseline.
4. The provenance and reason for the change can be inspected.
5. The change survives restart and can be rolled back or corrected.
6. The feature does not bypass existing memory, model, or action safety boundaries.
