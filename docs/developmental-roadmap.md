# Developmental Implementation Roadmap

> **Status:** Proposed; follows the existing Phases A–E in `docs/roadmap.md`.  
> **Selected direction:** Developmental ambition, high internal autonomy, bounded external authority.  
> **Primary rule:** validate the current runtime before layering new autonomous behavior on top of it.

This roadmap is intentionally phase-based, not calendar-based. A phase is complete only when its exit criteria and regression tests pass.

## Where this begins

The repository's existing roadmap marks Phases A–E complete:

- A — Runtime Convergence
- B — Memory Lifecycle
- C — Retrieval + Context Selection
- D — Cognitive Core
- E — Reflection + Consolidation

However, the same roadmap records unresolved live-inference issues. Those are not considered complete merely because automated tests pass. Phase F is therefore a gate, not optional cleanup.

## Phase F — Runtime readiness and baseline

### F.0 Re-establish the reproducible baseline

- Clone the canonical repository and install dependencies from the lockfile.
- Run the documented build, typecheck, and test commands.
- Record Node/Python versions, inference backend, model/adapter identity, GPU/VRAM use, and test results.
- Verify that the active server uses the intended Arcon inference provider, not an accidental Ollama fallback.
- Preserve a baseline report so later developmental changes can be compared.

### F.1 Resolve conversation-readiness blockers

The existing roadmap lists these live-runtime blockers; retest each against the current branch and fix only confirmed failures:

1. Real-model correction/supersession reliability.
2. User confirmation/rejection flow for pending memories.
3. Consistency of real-model memory extraction.
4. Mood/emotion decay during neutral interactions.
5. Long-response timeout and latency on the target hardware.

### Exit criteria

- All existing automated checks pass.
- Each blocker has a reproducible test or a documented, accepted limitation.
- A multi-turn real-model test demonstrates memory correction, confirmation, recall, and state decay.
- Runtime identity and capabilities are truthful.
- No new autonomous scheduler or learning system is enabled before this gate passes.

## Phase G — Event journal and experience provenance

### Objective

Give Arcon a reliable temporal record from which learning can be derived.

### Work

- Define a versioned, typed event contract.
- Record user, Arcon, tool, and system outcomes with timestamps and provenance.
- Preserve the existing aggregate experience repository; treat it as a summary/read model.
- Add idempotent event ingestion and processor versioning.
- Link reflection candidates and memory mutations back to event IDs.
- Add privacy-aware retention and deletion semantics.
- Test ordering, duplicate delivery, restart recovery, and replay.

### Exit criteria

- A sequence of events can be replayed deterministically.
- Duplicate events do not double-apply experience or learning.
- Derived memory changes can be traced to source evidence.
- Existing memory lifecycle and reflection tests remain green.

## Phase H — Associative learning substrate

### Objective

Prove that Arcon can learn a small set of associations from experience and retain the learned state across restart.

### Work

- Create `@arcon/learning` only after the Phase G event contract is stable.
- Start with a sparse concept-association graph, not a large general-purpose neural network.
- Use normalized concept/entity IDs, not one neuron per token.
- Implement bounded co-occurrence/Hebbian updates.
- Add explicit reward modulation from validated feedback/outcomes.
- Add eligibility traces only after the basic update rule has a reliable benchmark.
- Persist updates and versioned snapshots in SQLite.
- Add inspection tooling to explain why an association strengthened.
- Keep the system independent of the LLM and GPU.

### Exit criteria

- Learns a defined association benchmark better than its untrained baseline.
- Generalization and false-association rates are measured.
- State survives process restart.
- Every update has provenance and is reversible.
- CPU, memory, and latency budgets are documented.

## Phase I — Predictive learning and memory consolidation

### Objective

Move beyond co-occurrence into useful temporal prediction and evidence-weighted consolidation.

### Work

- Use ordered events to learn simple next-event/transition predictions.
- Measure prediction confidence and calibration.
- Add novelty and surprise scores for candidate experiences.
- Use predictions to rank retrieval candidates or surface knowledge gaps; do not let them overwrite facts.
- Integrate learning signals with the existing ReflectionEngine and MemoryPipeline.
- Add controlled forgetting/pruning only after retention and catastrophic-forgetting tests exist.

### Exit criteria

- Predictions beat a frequency-only baseline on held-out sequences.
- Weak predictions cannot become authoritative memories.
- Consolidation preserves provenance and memory lifecycle.
- Forgetting does not remove high-value verified knowledge without an auditable policy.

## Phase J — Appraisal and affective development

### Objective

Evolve the existing emotion system from event lookup toward context-sensitive appraisal.

### Work

- Keep the existing EmotionEngine API compatible.
- Add appraisal features: novelty, goal relevance, expectedness, controllability, social relevance, and confidence.
- Separate transient affect, slower mood, and relationship trust.
- Derive bounded emotion transitions from appraisals.
- Make affect influence attention, exploration, and response strategy in controlled ways.
- Validate decay, neutral recovery, saturation, and resistance to emotional mirroring.
- Never use affect to override safety, evidence, or user instructions.

### Exit criteria

- Appraisal outputs are deterministic for the same inputs and version.
- State changes are explainable and persist correctly.
- Neutral time and interactions move state toward baseline as specified.
- Affective state changes behavior measurably without destabilizing response quality.

## Phase K — Motivation, curiosity, and persistent goals

### Objective

Allow Arcon to identify useful learning opportunities and maintain its own bounded objectives.

### Work

- Introduce persistent goal contracts with origin, evidence, priority, status, budget, and success criteria.
- Distinguish user goals, intrinsic computational goals, and derived subgoals.
- Build a curiosity queue from uncertainty, novelty, prediction errors, and user-approved interests.
- Rank opportunities by relevance, expected value, confidence, and cost.
- Add cooldowns and duplicate suppression to avoid repetitive questions.
- Let Arcon propose goals autonomously; keep external commitments user-controlled.

### Exit criteria

- Arcon can create a justified learning goal from a genuine knowledge gap.
- Goals survive restart and can be paused, cancelled, or completed.
- Every goal has measurable success criteria and a resource budget.
- Curiosity actions are relevant, non-repetitive, and can be declined.

## Phase L — Planning and bounded agency

### Objective

Turn goals into structured plans and safely execute permitted work.

### Work

- Add a planner that returns typed steps, dependencies, expected outcomes, and risk labels.
- Add a policy/action gateway independent of the planner.
- Begin with internal actions and isolated scratch-workspace operations.
- Add explicit approval for consequential external actions.
- Revalidate every tool argument and permission at execution time.
- Add job persistence, cancellation, retry policy, rate limits, and crash recovery.
- Record action proposals, approvals, execution results, and verification evidence.
- Do not grant unrestricted filesystem, shell, browser, account, or network access.

### Exit criteria

- A multi-step internal goal can be planned, executed, verified, and resumed after restart.
- A denied or unapproved action cannot reach a tool.
- Cancellation and budget exhaustion stop execution safely.
- Action history is auditable and linked to the originating goal.

## Phase M — Self-model and developmental reflection

### Objective

Give Arcon an evidence-backed model of its own capabilities, interests, and behavioral tendencies.

### Work

- Separate identity invariants from mutable traits and transient state.
- Track capabilities only when backed by tests or runtime probes.
- Track interests with evidence, confidence, and decay.
- Compare predicted outcomes with actual outcomes.
- Generate reflection candidates from repeated successes, failures, corrections, and prediction errors.
- Route durable knowledge changes through MemoryPipeline.
- Require review/approval for changes to identity invariants, permissions, policies, and implementation.

### Exit criteria

- Self-model statements have evidence and confidence.
- Traits change slowly and remain stable under isolated events.
- Capabilities cannot be self-certified without verification.
- Reflection improves a measured behavior over a baseline.

## Phase N — Integrated developmental runtime

### Objective

Run learning, affect, curiosity, goals, and reflection as one persistent process.

### Work

- Create one process-wide DevelopmentalRuntime in `apps/server`.
- Inject shared services into conversation-scoped ChatService instances.
- Start event-driven workers only after state restoration and health checks.
- Add scheduler budgets, backpressure, observability, graceful shutdown, and recovery.
- Expose truthful runtime diagnostics for background processing and autonomy.
- Add end-to-end tests across conversation, event journal, learning, goals, action policy, and restart.

### Exit criteria

- One shared developmental state is used across conversations.
- Background jobs do not multiply with conversation count.
- Restart restores state without duplicate work.
- Resource limits and shutdown behavior are tested.
- The system can demonstrate a complete loop: observe -> learn -> predict -> propose goal -> plan -> permitted action -> verify -> reflect.

## Phase O — Optional perception and external tools

Only after the integrated runtime is stable:

- source-tracked web research;
- screen awareness and OCR/vision;
- full voice pipeline;
- desktop integration;
- browser automation and computer control;
- multi-agent collaboration.

Each capability must use the same policy gateway, evidence model, event journal, and audit trail. These are optional capability expansions, not prerequisites for developmental learning.

## Evaluation gates

Every phase must report:

| Dimension | Minimum evidence |
|---|---|
| Learning | baseline vs trained association/prediction quality |
| Generalization | held-out examples and false-positive rate |
| Memory | retrieval precision, correction behavior, provenance |
| Affect | repeatability, decay, bounded transitions, behavior impact |
| Curiosity | relevance, novelty, repetition rate, user acceptance |
| Goals | completion rate, usefulness, cost, cancellation |
| Agency | policy compliance, verified outcomes, recovery |
| Stability | regression suite, restart/replay, resource budgets |

A milestone is not complete because Arcon produced a convincing sentence. It is complete when persistent state changes correctly, future behavior improves measurably, evidence is inspectable, and the change survives restart.

## Recommended first implementation slice

After cloning, start with Phase F.0 only. Do not create `@arcon/learning` or `@arcon/agency` yet. Establish a clean runtime baseline first, then work on one confirmed blocker at a time.
