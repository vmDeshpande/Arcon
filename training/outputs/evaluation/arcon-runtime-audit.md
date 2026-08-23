# Arcon Runtime Foundation — Architecture Audit

## STATUS: AUDIT_COMPLETE

---

## A. WHAT ARCON CURRENTLY IS

Arcon is a local-first AI companion project consisting of two distinct runtimes:

1. **Node.js runtime** (`apps/server` + `apps/chat` + `packages/*`)
   - A TypeScript monorepo with Express server, Ollama client, memory system, personality system, cognition system, and voice interface.
   - **Two divergent chat paths exist**:
     - `apps/server`: Simple Express + Ollama proxy. Does **not** use `ChatService`. No personality, memory, cognition, or entity systems are active in this path.
     - `apps/chat`: Full `ChatService` runtime. This is the real Arcon runtime. It integrates identity, memory, personality, cognition, entities, and conversation history.

2. **Python training pipeline** (`training/scripts/`)
   - LoRA/QLoRA fine-tuning scripts for Qwen models using `transformers` + `peft`.
   - Produces adapter weights saved to `training/outputs/arcon-v1/` and `training/outputs/arcon-v2/`.
   - Evaluation scripts (`evaluate_arcon.py`) run inference independently using `vllm`/`transformers` pipelines with adapter loading.

**Critical gap**: The Node.js runtime (`apps/chat`) does **not** load LoRA adapters. It serves a fixed Ollama model (`qwen3:1.7b` in the CLI, configurable via `OLLAMA_MODEL`). The trained V1/V2 adapters exist only in the Python training ecosystem and were evaluated in isolation. The Node.js runtime has **no mechanism** to load or apply these adapters.

---

## B. WHAT THE MODEL CURRENTLY KNOWS

The model's knowledge comes from three sources:

1. **Base model weights** (Qwen/Qwen3-4B or qwen3:1.7b)
   - General knowledge, reasoning, coding, etc.
   - No intrinsic knowledge of Arcon's runtime state.

2. **LoRA adapters** (V1, V2 Epoch 2, V2 Epoch 3)
   - Trained on curated JSONL datasets under `training/datasets/arcon_v1/sources/`.
   - Categories: identity, cognition, emotion, curiosity, memory, personality, anomalies.
   - The model learns to **generate text patterns** associated with Arcon identity, but has no live connection to runtime state.

3. **System prompt injection** (at inference time)
   - The Node.js runtime assembles a system prompt containing:
     - Identity prompt (`buildIdentityPrompt()`)
     - Relationship prompt (`buildRelationshipPrompt()`)
     - Behavior prompt (`buildBehaviorPrompt()`)
     - Memory context (`buildMemoryContext()`)
     - Conversation history
     - Relevant past conversations
     - Cognitive strategy

**What the model does NOT know**:
- It does not know the actual value of runtime variables (current emotion scores, interest weights, memory contents).
- It does not know whether persistent memory exists or not.
- It does not know whether background processing is happening.
- Its "knowledge" of Arcon is entirely from training data + prompt injection.

---

## C. WHAT THE RUNTIME CURRENTLY KNOWS

The Node.js runtime (`ChatService` + packages) maintains extensive state:

### State Systems (all backed by SQLite)

| System | Database Table(s) | Current State |
|---|---|---|
| **Identity** | Hardcoded constant | `ARCON_IDENTITY` in `packages/personality/src/identity/arcon-identity.ts` |
| **Relationship** | Hardcoded constant | `ARCON_RELATIONSHIP` in `packages/personality/src/relationship/relationship-profile.ts` |
| **Emotions** | `emotions` table | 5 emotions: curiosity, trust, happiness, confidence, frustration |
| **Interests** | `interests` + `arcon_interests` tables | User interests + Arcon self-interests |
| **Experiences** | `experiences` table (via `ExperienceRepository`) | 40 experience types |
| **Mood** | `mood` table (via `MoodRepository`) | Frustration, askCount, pendingQuestion, trust, excitement |
| **Personal Memory** | `personal_memories` table | Structured memories with type, importance, confidence, status |
| **Entities** | `entities` table | Named entities (people, pets, projects, places) |
| **Entity Facts** | `entity_facts` table | Facts about entities |
| **Entity Relationships** | `entity_relationships` table | Relationships between entities |
| **Conversations** | `conversations` + `messages` tables | Full conversation history with topics, summary, metadata |

### In-Memory State (not persisted)

| System | Location | Notes |
|---|---|---|
| **ConversationContext** | `packages/ai/src/conversation-context.ts` | Last 20 turns per conversation ID. Lost on server restart. |
| **Active Entity** | `ConversationEntityTracker` | Currently tracked entity in conversation. Lost on restart. |
| **CognitiveAdapter thought** | Created per-turn | UUID, timestamp, strategy, metadata. Not persisted. |

---

## D. WHAT PERSISTS BETWEEN MESSAGES

Within a single server session:

- **SQLite databases**: All persist between messages.
  - `data/memories/conversation.sqlite` — conversation messages
  - `data/personal-memory.sqlite` — personal memories, emotions, interests, arcon_interests
  - `data/experiences.sqlite` — experience records
  - `data/mood.sqlite` — mood state
  - `apps/chat/data/entities.sqlite` — entities, facts, relationships

- **In-memory maps**:
  - `ConversationContext.histories` — Map<conversationId, ConversationTurn[]> (last 20 turns)
  - `ConversationEntityTracker.activeEntity` — current entity focus

- **ChatService instance**:
  - All engines (emotion, mood, interest, experience, entity, knowledge) persist their state to SQLite on every update.
  - The `conversationId` is generated once per `ChatService` instance (`crypto.randomUUID()`).

---

## E. WHAT PERSISTS BETWEEN SESSIONS

**Persists across server restarts** (SQLite on disk):
- All personal memories
- All emotions, interests, arcon_interests
- All experiences
- All mood state
- All entities, facts, relationships
- All conversation messages and metadata

**Does NOT persist across server restarts**:
- `ConversationContext` in-memory history (last 20 turns)
- `ConversationEntityTracker.activeEntity`
- `ChatService` instance state (emotion decay timestamps, etc.)
- Any runtime configuration loaded from `.env`

**Important**: The `conversationId` is generated per `ChatService` instance in `apps/chat/src/index.ts`. Each time the CLI starts, a new `ChatService` is created with a new random `conversationId`. However, the `ConversationStore` can retrieve past conversations by search, and `getRelevantConversationHistory` can pull context from previous sessions.

---

## F. WHAT IS CURRENTLY STORED ANYWHERE

### SQLite Databases

| Database Path | Tables | Purpose |
|---|---|---|
| `data/memories/conversation.sqlite` | `conversations`, `messages` | Short-term conversation history |
| `data/personal-memory.sqlite` | `personal_memories`, `emotions`, `interests`, `arcon_interests` | Personal memories + emotional/interest state |
| `data/experiences.sqlite` | `experiences` | Experience records |
| `data/mood.sqlite` | `mood` | Mood state |
| `apps/chat/data/entities.sqlite` | `entities`, `entity_facts`, `entity_relationships` | Entity graph |

### In-Memory

| Location | Purpose |
|---|---|
| `ConversationContext` | Last 20 turns of current conversation |
| `ConversationEntityTracker` | Active entity in current conversation |
| `CognitiveAdapter` thought | Per-turn reasoning metadata |

---

## G. WHAT IS CURRENTLY RETRIEVED INTO PROMPTS

The `PromptBuilder.build()` method in `packages/ai/src/prompt-builder.ts` assembles:

```
SYSTEM:
{identityPrompt}
{relationshipPrompt}
{behaviorPrompt}

RESPONSE STRATEGY:
{strategy, reason, tone}

MEMORIES:
{userProfile}
{relevantMemories}

RELEVANT PAST CONVERSATIONS:
{conversationId: ...}
User: ...
Arcon: ...

CONVERSATION:
{last 20 turns of current conversation}

USER:
{current message}
```

**What gets injected**:
- **Identity**: Hardcoded name, creator, version, purpose, traits, core rules, internal self-model.
- **Relationship**: Hardcoded relationship profile + examples.
- **Behavior**: Current mood label, 5 emotion scores, top interests, top arcon_interests.
- **User Profile**: All user memories (preferences + relationships) from repository.
- **Relevant Memories**: Top-ranked memories from `MemoryRetriever` (keyword + entity matching).
- **Relevant Past Conversations**: Up to 2 past conversations with their last 6 messages each, matched by keyword similarity.
- **Current Conversation**: Last 20 turns from `ConversationContext`.

**What does NOT get injected**:
- Experience history (only counts/summaries are used for cognitive strategy).
- Entity graph directly (only synthesized as "memories").
- Mood history (only current state).
- Any background processing status.

---

## H. DOES A LONG-TERM MEMORY SYSTEM ALREADY EXIST?

**YES.**

`packages/memory` implements a complete personal memory engine:

- **Storage**: `MemoryRepository` with `personal_memories` table (SQLite).
- **Categories**: FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT.
- **Status**: ACTIVE, ARCHIVED, OBSOLETE, CONTRADICTED, PENDING_CONFIRMATION.
- **Scoring**: importance_score (1-10), confidence_score (0-1).
- **Extraction**: Two extractors:
  1. `MemoryExtractor` (regex-based, deterministic patterns).
  2. `LlmMemoryExtractor` (LLM-based semantic extraction via Ollama).
- **Validation**: `SemanticValidator` + `SemanticNormalizer`.
- **Entity resolution**: `EntityResolver` links memories to entities.
- **Pipeline**: `MemoryPipeline` with CREATE/UPDATE/CONFLICT/IGNORE decisions.
- **Retrieval**: `MemoryRetriever` with keyword scoring + entity graph expansion.
- **Context building**: `buildMemoryContext()` formats memories for prompt injection.
- **Ranking**: `calculateMemoryScore()` considers relevance, importance, confidence, recency.

This is a **real, functional** memory system. It is not a placeholder.

---

## I. DOES AN IDENTITY/STATE SYSTEM ALREADY EXIST?

**YES.**

### Identity System
- **Source**: `packages/personality/src/identity/arcon-identity.ts`
  - Hardcoded `ARCON_IDENTITY` constant with name, creator, version, purpose, traits, core rules.
- **Prompt generation**: `buildIdentityPrompt()` in `identity-builder.ts`.
- **Runtime recall**: `IdentityRecall` in `packages/ai/src/reasoning/identity-recall.ts` handles:
  - "Who are you?"
  - "Do you have emotions?"
  - "What are your interests?"
  - "Tell me about yourself"
  - "Who created you?"
  - "Who am I?"
  - "What do you know about me?"
  - "List everything you remember about me"

### Relationship System
- **Source**: `packages/personality/src/relationship/relationship-profile.ts`
  - Hardcoded `ARCON_RELATIONSHIP` constant.
- **Prompt generation**: `buildRelationshipPrompt()`.
- **Runtime recall**: `RelationshipRecall` handles:
  - "What is our relationship?"
  - "Why do you exist?"
  - "Compare yourself to me"

### State Systems
- **EmotionManager**: 5 tracked emotions with decay.
- **MoodEngine**: Derived mood state with frustration, trust, excitement, askCount, pendingQuestion.
- **InterestEngine**: User interests + Arcon self-interests with decay.
- **ExperienceManager**: 40 experience types tracked.
- **Entity system**: Full graph with entities, facts, relationships.

---

## J. DO MULTIPLE CONVERSATIONS SHARE STATE?

**YES.**

All `ChatService` instances that use the **same SQLite database files** share:
- Personal memories
- Emotions
- Interests
- Arcon interests
- Experiences
- Mood state
- Entities, facts, relationships
- Conversation history

The only per-session state that does NOT leak is:
- `ConversationContext` (in-memory, last 20 turns)
- `ConversationEntityTracker.activeEntity`
- `ChatService` instance configuration

However, `ConversationStore.getRelevantConversationHistory()` can pull messages from **previous sessions** into the current prompt, so conversation context does cross session boundaries via SQLite.

---

## K. DOES THE MODEL HAVE A MECHANISM FOR KNOWING ITS ACTUAL RUNTIME CAPABILITIES?

**PARTIALLY.**

### What exists:
1. **Hardcoded identity prompt** tells the model:
   - Its name, creator, version, purpose, traits, core rules.
   - Its internal self-model (emotions, interests, self-model).
   - Explicit rules: "User memories belong to the user", "Never claim user memories as your own", "Be transparent about uncertainty", "Learn through observation and interaction".

2. **Behavior prompt** injects actual runtime state:
   - Current mood label.
   - Current emotion scores (curiosity, trust, happiness, confidence, frustration).
   - Current interests and Arcon interests.
   - Response strategy, tone, reason.

3. **Memory context** injects actual retrieved memories.

4. **Identity recall handlers** provide hardcoded factual responses for specific questions.

5. **Relationship recall handlers** provide hardcoded factual responses.

6. **Project recall handlers** provide actual project memories from the repository.

### What is MISSING:
1. **No capability registry**: There is no structured representation of "what Arcon can and cannot do." The model relies on training data + prompt hints.
2. **No limitation grounding**: The model is not explicitly told what it cannot do (no background processing, no persistent identity across sessions, no consciousness, no personhood).
3. **No runtime capability introspection**: The runtime does not expose a method like `getCapabilities()` or `getLimitations()` that could be injected into the prompt.
4. **Training data contradicts runtime**: The V1/V2 training data teaches the model to claim capabilities (persistent memory, long-term memory, "full Arcon state") that the runtime does not actually provide in the way the model describes.

---

## L. WHERE IS THE CURRENT SYSTEM PROMPT ASSEMBLED?

The system prompt is assembled in **two places**:

1. **`packages/ai/src/prompt-builder.ts`** — `PromptBuilder.build()`
   - This is the canonical prompt assembly point.
   - It combines: systemPrompt + strategy + memoryContext + relevantConversations + conversationHistory + userMessage.

2. **`packages/ai/src/chat-service.ts`** — `ChatService.chat()` and `ChatService.chatStream()`
   - This is where the **components** of the system prompt are gathered:
     - `buildIdentityPrompt()` from `@arcon/personality`
     - `buildRelationshipPrompt()` from `@arcon/personality`
     - `buildBehaviorPrompt()` from `@arcon/personality`
     - `buildUserProfile()` from `@arcon/personality`
     - `buildMemoryContext()` from `@arcon/memory`
     - `conversationContext.toPromptLines()` from `ConversationContext`
     - `conversationStore.getRelevantConversationHistory()` from `ConversationStore`
     - `cognitiveAdapter.process()` from `CognitiveAdapter`

The final assembled prompt is a single string passed as a `system` role message to Ollama.

---

## M. WHERE CAN MODEL-GENERATED CLAIMS ABOUT ARCON BE GROUNDED?

The following locations are where factual claims about Arcon are defined or injected:

| Claim Type | Source Location | Current State |
|---|---|---|
| Name, creator, version, purpose | `packages/personality/src/identity/arcon-identity.ts` | Hardcoded constant |
| Relationship profile | `packages/personality/src/relationship/relationship-profile.ts` | Hardcoded constant |
| Emotional self-model | `packages/personality/src/identity/identity-builder.ts` (Internal Self-Model section) | Hardcoded description |
| Current emotions | `packages/personality/src/emotion/emotion-engine.ts` | Live SQLite state |
| Current interests | `packages/personality/src/interest/interest-engine.ts` | Live SQLite state |
| Current mood | `packages/personality/src/mood/mood-engine.ts` | Live SQLite state |
| Current experiences | `packages/personality/src/experience/experience-manager.ts` | Live SQLite state |
| User memories | `packages/memory/src/personal-memory.ts` (MemoryRepository) | Live SQLite state |
| Conversation history | `packages/memory/src/conversation-store.ts` | Live SQLite state |
| Past conversation context | `packages/memory/src/conversation-store.ts` (getRelevantConversationHistory) | Live SQLite state |
| Entity facts | `packages/memory/src/entity/` | Live SQLite state |
| Response strategy | `packages/ai/src/cognitive-adapter.ts` | Computed per-turn |

**What is NOT grounded anywhere**:
- "I have persistent identity across sessions" — no source.
- "I continue working in the background" — no source.
- "I have full Arcon state" — no single source defines this.
- "I am a person" — no source; actively contradicted by training data.
- "I learn and develop over time" — partially true (interests, experiences change) but overstated in training data.

---

## ARCHITECTURE SUMMARY

### What Actually Exists

The Arcon runtime is **significantly more advanced** than the `docs/architecture.md` document claims. The project has outgrown its documentation.

**Implemented systems**:
- ✅ SQLite-backed personal memory (FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT)
- ✅ Regex + LLM memory extraction with validation, normalization, and deduplication
- ✅ Memory retrieval with keyword scoring and entity graph expansion
- ✅ Memory context injection into prompts
- ✅ Hardcoded identity system (name, creator, version, purpose, traits, rules)
- ✅ Identity recall handlers for common questions
- ✅ Relationship system with hardcoded profile
- ✅ Emotion engine (5 emotions with decay)
- ✅ Mood engine (frustration, trust, excitement, askCount, pendingQuestion)
- ✅ Interest engine (user interests + Arcon self-interests with decay)
- ✅ Experience manager (40 experience types)
- ✅ Entity system (entities, facts, relationships, knowledge builder)
- ✅ Conversation context (in-memory, last 20 turns)
- ✅ Conversation store (SQLite, full history with search)
- ✅ Cognitive adapter (intent classification, strategy selection)
- ✅ Prompt builder (modular assembly of all components)
- ✅ Voice interface layer (STT, TTS, streaming)
- ✅ Event bus + logging
- ✅ Python LoRA training pipeline with checkpoint/resume
- ✅ Evaluation infrastructure

### What Does NOT Exist

| Capability | Status | Notes |
|---|---|---|
| **LoRA adapter loading in Node.js runtime** | ❌ NOT IMPLEMENTED | The Node.js runtime serves a fixed Ollama model. Trained adapters are not loaded. |
| **Persistent conversation context across restarts** | ❌ NOT IMPLEMENTED | `ConversationContext` is in-memory only. |
| **Background processing / self-improvement** | ❌ NOT IMPLEMENTED | No background jobs, no scheduled tasks. |
| **Vector database / semantic search** | ❌ NOT IMPLEMENTED | Memory retrieval uses keyword matching + entity matching only. |
| **Capability/limitation registry** | ❌ NOT IMPLEMENTED | No structured representation of what Arcon can/cannot do. |
| **Adapter version tracking** | ❌ NOT IMPLEMENTED | No mechanism to know which LoRA adapter is loaded (because none are loaded in Node.js). |
| **Session isolation for memory** | ⚠️ PARTIAL | All conversations share the same SQLite databases. No per-session memory scoping. |

---

## CRITICAL ARCHITECTURAL INSIGHT

The V2 behavioral failures stem from a **mismatch between training data and runtime reality**:

1. **Training data teaches**: "I have persistent memory", "I have long-term memory", "I have full Arcon state", "I continue working in the background."
2. **Runtime provides**: SQLite-backed personal memories that ARE persistent across messages and sessions, but the model does not have live access to them — they are injected into prompts as text.
3. **Model hallucinates**: Because the training data claims capabilities that sound like the runtime's aspirational design, the model overgeneralizes and claims capabilities that don't exist (personhood, background processing, persistent identity across sessions).

The correct fix is **not** to train the model to claim these capabilities. The correct fix is to:
1. Make the runtime capabilities real.
2. Inject accurate capability/limitation facts into the prompt.
3. Retrain the model on **actual** runtime behavior, not aspirational design docs.

---

## FILES CREATED/MODIFIED

No files were modified during this audit. This is a read-only analysis.

Key files inspected:
- `docs/architecture.md` (outdated)
- `docs/roadmap.md`
- `docs/memory-engine.md` (design doc, partially implemented)
- `docs/decisions.md`
- `apps/server/src/*.ts` (simple Express proxy)
- `apps/chat/src/index.ts` (full ChatService CLI)
- `packages/ai/src/chat-service.ts` (core runtime)
- `packages/ai/src/prompt-builder.ts` (prompt assembly)
- `packages/ai/src/cognitive-adapter.ts` (strategy selection)
- `packages/ai/src/conversation-context.ts` (in-memory history)
- `packages/ai/src/reasoning/*.ts` (identity, relationship, project recall)
- `packages/ai/src/context/intent-classifier.ts`
- `packages/memory/src/*.ts` (full memory system)
- `packages/memory/src/retrieval/*.ts` (retrieval, ranking, context)
- `packages/memory/src/pipeline/*.ts` (extraction, review, processing)
- `packages/memory/src/semantic/*.ts` (LLM-based extraction)
- `packages/memory/src/entity/*.ts` (entity graph)
- `packages/memory/src/conversation-store.ts` (SQLite conversation history)
- `packages/personality/src/identity/*.ts` (hardcoded identity)
- `packages/personality/src/relationship/*.ts` (hardcoded relationship)
- `packages/personality/src/experience/*.ts` (experience tracking)
- `packages/personality/src/emotion/*.ts` (emotion engine)
- `packages/personality/src/mood/*.ts` (mood engine)
- `packages/personality/src/interest/*.ts` (interest engine)
- `packages/cognition/src/*.ts` (reasoning pipeline, plugins)
- `packages/shared/src/index.ts` (types, event bus)
- `training/scripts/train_arcon_v1.py`
- `training/scripts/train_arcon_v2.py`
- `training/datasets/arcon_v1/dataset_manifest.json`
- `training/datasets/arcon_v1/sources/identity.jsonl`

---

## NOT IMPLEMENTED (Intentionally Left for Next Phase)

1. **LoRA adapter loading in Node.js runtime** — The trained adapters are evaluated in Python only. The Node.js runtime serves a fixed Ollama model. This is the **highest priority** gap for runtime foundation.
2. **Capability/limitation registry** — No structured source of truth for what Arcon can/cannot do.
3. **Persistent conversation context** — In-memory `ConversationContext` is lost on restart.
4. **Background processing** — No scheduled tasks, no self-improvement loop.
5. **Vector database / semantic search** — Memory retrieval is keyword-based only.
6. **Session-scoped memory** — All conversations share the same memory stores.
7. **Adapter version tracking** — No mechanism to identify which adapter/runtime version is active.
8. **Truthful self-description mechanism** — No systematic way for the model to answer capability questions from runtime state rather than training data.

---

## V1 STATUS

- **touched**: NO
- All V1 artifacts remain intact at `training/outputs/arcon-v1/`

## V2 STATUS

- **touched**: NO
- All V2 artifacts remain intact at `training/outputs/arcon-v2/`

## TRAINING STATUS

- **V3 training started**: NO
- **100-prompt evaluation started**: NO

---

## NEXT PHASE RECOMMENDATION

Based on this audit, the recommended next implementation phase is:

### Phase 0: Runtime Adapter Loading (Highest Priority)

The Node.js runtime must be able to load and apply the trained LoRA adapters. Without this, the runtime and the trained model are completely disconnected. This requires:

1. **Investigate Ollama's LoRA/adapter support** or implement a local inference path that can load PEFT adapters.
2. **If Ollama cannot load adapters**, implement a direct `vllm`/`transformers` inference endpoint in the Node.js runtime (or a separate inference microservice) that mirrors what the Python evaluation scripts do.
3. **Track adapter version** in the runtime so the model knows which adapter is active.

### Phase 1: Capability Grounding

Before retraining V3, create a structured capability/limitation representation:

1. Define `ArconCapabilities` and `ArconLimitations` interfaces.
2. Populate them from actual runtime state (database existence, engine availability, background processing status).
3. Inject them into the system prompt via `PromptBuilder`.
4. Add a `CapabilityRecall` handler (similar to `IdentityRecall`) for direct capability questions.

### Phase 2: Persistent Conversation Context

1. Move `ConversationContext` state into SQLite or provide a reconstruction method from `ConversationStore`.
2. Ensure the last N turns survive server restarts.

### Phase 3: Retrain V3 with Runtime-Grounded Data

Only after Phases 0-2 are complete:

1. Generate training data from **actual** runtime behavior (not aspirational specs).
2. Include explicit capability/limitation Q&A pairs derived from the real `ArconCapabilities` and `ArconLimitations` objects.
3. Exclude any claims about background processing, personhood, or persistent identity across sessions unless the runtime actually implements them.
4. Validate V3 against the 100-prompt evaluation set with the **actual runtime** (not isolated Python inference).
