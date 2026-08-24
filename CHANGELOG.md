# Changelog

## [Unreleased] — Initial Development Milestone

### Added
- persistent memory lifecycle with structured states (ACTIVE, ARCHIVED, OBSOLETE, CONTRADICTED, PENDING_CONFIRMATION, SUPERSEDED)
- memory scope enforcement (USER, ARCON, PROJECT, ENTITY, CONVERSATION)
- selective memory retrieval with SQL-level prefiltering and relevance threshold
- ContextSnapshot as structured internal state for context selection
- CognitiveDecision as structured cognitive output (intent, strategy, confidence, clarification, stages)
- clarification routing when context is insufficient
- runtime identity/capability grounding in system prompts
- Experience recording with provenance context
- Reflection and consolidation through MemoryPipeline (CREATE, UPDATE, SUPERSEDE, ARCHIVE, NO_OP)
- evidence tracking for all reflection proposals
- configurable background reflection trigger
- supersession with historical lineage preservation via supersedesId
- canonical Express runtime at apps/server
- Python FastAPI inference service for Qwen/Qwen3-4B + Arcon V1 LoRA
- emotion, mood, interest, and personality systems
- entity graph with facts, relationships, and linked memories

### Changed
- canonical runtime architecture (apps/server)
- CognitiveAdapter produces real structured decisions instead of hardcoded defaults
- retrieval behavior focuses on fewer, better memories rather than comprehensive recall
- memory lifecycle is enforced during retrieval, not just stored
- reflection proposals route through MemoryPipeline rather than bypassing lifecycle rules
- documentation updated to reflect Phases A–E

### Removed
- divergent runtime paths (apps/chat)
- dead/orphaned reasoning modules (packages/ai/src/reasoning/)
- unused personality profile manager (packages/personality/src/profile/)
- unused entity resolver and graph query modules (packages/memory/src/entity/)
- unused experience classifier (packages/ai/src/experience/arcon-experience-classifier.ts)

### Fixed
- context contamination prevention in intent-specific retrieval
- supersession lineage preservation
- memory scope filtering enforcement
- clarification routing without blocking response generation
