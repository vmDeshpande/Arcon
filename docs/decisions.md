# Decisions

## Runtime

The canonical runtime is `apps/server` (Express + `ChatService`). Dead/orphaned runtime paths were removed during Phase A to reduce maintenance surface and eliminate inconsistent behavior.

## Inference

The active inference path is the Python FastAPI service (`services/arcon-inference/`) serving Qwen/Qwen3-4B + Arcon V1 LoRA adapter. The Node.js runtime connects via `ARCON_INFERENCE_BASE_URL`. `OllamaClient` is preserved for compatibility but is not the active production path.

## Storage

SQLite is used for all persistent state: conversations, memories, emotions, mood, interests, experiences, and entities. The database files live under `data/` and `apps/server/data/`.

## Memory Lifecycle

Memories have explicit lifecycle states (ACTIVE, ARCHIVED, OBSOLETE, CONTRADICTED, PENDING_CONFIRMATION, SUPERSEDED). The `MemoryPipeline` enforces these states during retrieval. Supersession preserves historical lineage via `supersedesId`. Memories are never silently overwritten.

## Retrieval

Retrieval uses SQL-level prefiltering by status and scope, then applies keyword relevance, importance, confidence, evidence count, and recency scoring. An explicit relevance threshold excludes weak matches. The goal is to retrieve fewer, better memories.

## Cognitive Processing

The cognitive layer produces structured `CognitiveDecision` objects rather than returning hardcoded defaults. Clarification routing short-circuits full generation when context is insufficient. Runtime identity/capability grounding is included in the system prompt.

## Reflection

Reflection examines accumulated experiences and proposes memory changes. All proposals route through `MemoryPipeline`. Reflection never directly bypasses the memory lifecycle. Evidence and provenance are tracked for every proposal.

## Modular Cognition

Memory does not know about emotions. Emotions do not know about prompt generation. Prompt generation does not know how memories are stored. Every cognitive system has one clear responsibility.

## Local First

Everything important works without cloud services. The user owns their data. No core behaviour depends on remote APIs.

## Explainable Behaviour

Every memory has source, confidence, importance, timestamps, status, and evidence count. Knowledge is always auditable. Reflection proposals retain full provenance.
