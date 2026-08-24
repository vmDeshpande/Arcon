# Changelog

## [Unreleased]

### Added
- Future work beyond the cognitive architecture milestone

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
