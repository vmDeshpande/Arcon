# Changelog

## [Unreleased]

### Added
- Future work beyond the cognitive architecture milestone
- memory mutation audit log (`memory_audit_log` table) tracking CREATE, UPDATE, SUPERSEDE, ARCHIVE, CONFIRM, REJECT, and CONTRADICT actions with timestamps, source, and content deltas
- prompt-injection safety boundary in `MemoryExtractor` rejecting instruction-like patterns (ignore-all-previous, reveal-system-prompt, jailbreak, DAN mode, etc.)
- `MemoryPipeline.confirmPendingMemory`, `rejectPendingMemory`, `markMemoryContradicted`, `resolveContradiction` methods
- `MemoryRepository.confirmPendingMemory`, `rejectPendingMemory`, `resolveContradiction`, `getMutations` methods
- entity-name-aware general memory filtering to prevent unrelated entity leakage during retrieval

### Changed
- retrieval ranking formula: relevance now dominates over generic importance/confidence (irrelevance penalty of -1000 for zero keyword matches)
- entity retrieval merged with general memory retrieval instead of short-circuiting
- `retrieveEntityMemories` no longer applies a hard limit; limit is enforced only at the final merge/rank stage
- repeated confirmation of already-active memory returns the existing memory instead of null

### Fixed
- rejected-value protection: superseded/obsolete/contradicted/pending memories cannot be recreated from re-extraction
- entity retrieval no longer suppresses relevant broader context
- PROJECT scope memories correctly isolated by scope during retrieval

### Testing
- 288 tests passing across 32 test files
- 0 failures
- all 8 workspaces build successfully

### Conversation Readiness Validation
- Added end-to-end conversation test suite (`conversation-e2e.test.ts`) covering basic memory lifecycle, memory rejection, supersession/contradiction, project isolation, mood tracking, and full integration
- Added memory lifecycle hardening tests (`memory-lifecycle.test.ts`) covering PENDING_CONFIRMATION resolution, CONTRADICTED state, PROJECT scope isolation, rejected-value protection, and retrieval ranking edge cases
- Added memory mutation audit log tests (`memory-audit.test.ts`) covering CREATE/UPDATE/SUPERSEDE/CONFIRM/REJECT/CONTRADICT mutation tracking and prompt-injection safety
- Enhanced mood system with explicit `MoodCategory` enum (NEUTRAL, CURIOUS, FOCUSED, HAPPY, CALM, EXCITED, CONCERNED, FRUSTRATED, SAD, PLAYFUL, SERIOUS)
- Implemented deterministic mood transitions with intensity and cause tracking
- Added mood persistence across service instances

### Real Runtime Validation — Known Blockers
Real runtime smoke testing against Qwen/Qwen3-4B + arcon-v1 LoRA on RTX 3050 revealed the following blockers that prevent the conversation-ready milestone from being declared complete:

1. **Supersession/correction does not trigger reliably with real LLM extraction**: The real LLM extraction output does not consistently produce content that triggers the supersession pipeline. Old memories remain ACTIVE even when the user explicitly states a correction. The e2e mock tests pass because they control extraction output exactly, but real runtime behavior differs.
2. **No runtime memory confirmation/rejection flow**: The runtime stores preferences immediately without asking for confirmation. The `PENDING_CONFIRMATION` state and rejection mechanism exist in the pipeline but are never triggered by the actual runtime.
3. **Real LLM extraction is inconsistent**: Extraction behavior varies between similar messages (e.g., Project A vs Project B statements). Some memories that should be created are silently not extracted.
4. **Mood decay not functioning**: Intensity does not decrease over neutral messages at runtime. The `decay()` mechanism exists but does not produce the expected intensity reduction.
5. **Full conversation timeout**: Longer complex messages can exceed the 300-second timeout on RTX 3050 + Qwen3-4B hardware.

**Status**: Automated tests pass (291/291), but real runtime verification is blocked by the above issues. The conversation-ready milestone is NOT yet complete.

## [0.4.0] — 2026-08-24

### Architecture
- canonical runtime convergence around `apps/server`
- removal of divergent/dead runtime paths (`apps/chat`, `packages/ai/src/reasoning/`)
- removal of unused personality profile manager (`packages/personality/src/profile/`)
- removal of unused entity resolver and graph query modules (`packages/memory/src/entity/`)
- removal of unused experience classifier (`packages/ai/src/experience/arcon-experience-classifier.ts`)
- structured `ContextSnapshot` as internal state between retrieval and prompt construction
- structured `CognitiveDecision` as cognitive output
- runtime identity/capability grounding in system prompts
- structured processing stages (`CognitiveDecision.stages`)

### Memory
- structured memory lifecycle enforcement during retrieval
- `MemoryScope` support (USER, ARCON, PROJECT, ENTITY, CONVERSATION)
- supersession lineage preservation via `supersedesId`
- historical memory preservation (no silent deletion)
- `PENDING_CONFIRMATION` and `CONTRADICTED` status handling
- invalid/stale memory exclusion from normal retrieval
- evidence count tracking for confidence reinforcement

### Retrieval
- SQL-level status/scope prefiltering
- scope-aware retrieval
- explicit relevance threshold
- separation of relevance from memory validity
- rejection of weak/irrelevant memories
- context contamination prevention in intent-specific retrieval

### Cognitive Processing
- `ContextSnapshot`-driven cognition
- structured `CognitiveDecision` output
- intent classification and strategy selection
- confidence scoring
- clarification routing when context is insufficient
- unresolved conflict representation
- response mode selection
- structured internal cognitive state

### Reflection
- Experience provenance support (`context` field)
- `ReflectionCandidate` with evidence tracking
- `ReflectionEngine` for pattern analysis
- `ReflectionProcessor` routing proposals through `MemoryPipeline`
- `ReflectionTrigger` for background/deferred execution
- configurable reflection thresholds
- evidence/provenance preservation for all proposals
- `CREATE` / `UPDATE` / `SUPERSEDE` / `ARCHIVE` / `NO_OP` reflection outcomes
- contradiction awareness with supersession preservation

### Testing
- 252 tests passing across 26 test files
- 0 failures
- all 8 workspaces build successfully

### Changed
- `CognitiveAdapter` integrated with actual cognitive pipeline
- retrieval behavior focuses on fewer, better memories
- memory lifecycle enforced during retrieval, not just stored
- reflection proposals route through `MemoryPipeline`
- documentation updated to reflect Phases A–E

### Fixed
- context contamination prevention in intent-specific retrieval
- supersession lineage preservation
- memory scope filtering enforcement
- clarification routing without blocking response generation
