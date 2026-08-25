# Roadmap

## Phase A — Runtime Convergence ✅ COMPLETE

- Canonical runtime path (`apps/server`)
- Dead/orphaned runtime paths removed
- Unused reasoning modules removed
- Unused personality profile manager removed
- Unused entity resolver/graph query removed

## Phase B — Memory Lifecycle ✅ COMPLETE

- Structured memory states enforced during retrieval
- SUPERSEDED memory lineage preserved via `supersedesId`
- Memory scope added and enforced
- Stale/invalid memory filtered from normal retrieval
- Relevance and validity separated
- Memory pipeline supports CREATE / UPDATE / SUPERSEDE / ARCHIVE / IGNORE / CONFLICT

## Phase C — Retrieval + Context Selection ✅ COMPLETE

- SQL-level prefiltering by status and scope
- Explicit relevance threshold
- `ContextSnapshot` as structured internal state
- Context selection is deterministic per intent category
- Context contamination prevented

## Phase D — Cognitive Core ✅ COMPLETE

- `CognitiveDecision` as structured cognitive output
- Clarification routing in `ChatService`
- Runtime identity/capability grounding
- Processing stages represented structurally
- PromptBuilder consumes `CognitiveDecision` and `ContextSnapshot`

## Phase E — Reflection + Consolidation ✅ COMPLETE

- Experience model extended with `context` for provenance
- `ReflectionEngine` analyzes accumulated experiences
- `ReflectionProcessor` routes proposals through `MemoryPipeline`
- `ReflectionTrigger` provides background/deferred execution
- Evidence tracking for all proposals
- Weak evidence rejection (configurable threshold)
- Supersession lineage preserved

## Conversation-Readiness Validation — BLOCKED

Automated validation is complete and passing (291/291 tests, 8/8 workspaces build).

Real runtime validation against Qwen/Qwen3-4B + arcon-v1 LoRA on RTX 3050 found the following blockers:

1. **Supersession/correction not reliable**: Real LLM extraction does not consistently produce content that triggers the supersession pipeline. Old memories remain ACTIVE even when the user explicitly corrects them.
2. **No runtime confirmation/rejection flow**: Preferences are stored immediately without user confirmation. The `PENDING_CONFIRMATION` mechanism exists but is not wired into the runtime.
3. **Inconsistent real LLM extraction**: Extraction behavior varies between similar messages. Some expected memories are silently not extracted.
4. **Mood decay not functioning**: Intensity does not decrease over neutral messages at runtime.
5. **Full conversation timeout**: Complex messages can exceed the 300s timeout on RTX 3050 + Qwen3-4B.

**Status**: The conversation-ready milestone is **NOT YET COMPLETE**. The above issues must be resolved before declaring conversation readiness.

## Future Phases

The following are planned but not yet implemented:

- Semantic vector search for memory retrieval
- Graph-based entity relationship reasoning
- Goal management system
- Planning engine
- Proactive conversations
- Web learning with external evidence attachment
- Computer interaction / screen awareness
- Autonomous workflows
- Multi-agent collaboration
- Voice conversation (full integration)
- Desktop application
- Memory decay engine
- Automatic memory merge
- Wake word / continuous listening
- Advanced VAD
- Streaming STT/TTS pipeline
