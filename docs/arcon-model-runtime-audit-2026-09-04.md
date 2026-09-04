# Arcon Runtime and Model Audit — 2026-09-04

## Purpose

This document records the architectural and model-runtime state of the Arcon repository as of 2026-09-04, following Phase 1 of the development direction: repository inspection and model/runtime audit.

It answers: **What model does the production Node.js runtime actually use? Can it load LoRA adapters? What cognitive infrastructure exists?**

---

## 1. Repository Structure

```
Arcon/
├── apps/
│   ├── server/           Canonical Express server (production entrypoint)
│   │   ├── src/          app.ts, index.ts, config.ts, events.ts
│   │   ├── public/       Static web UI (index.html)
│   │   ├── data/         Runtime SQLite databases (gitignored)
│   │   └── tests/        server.test.ts
│   ├── chat/             STUB — only data/ folder, no source code
│   └── desktop/          STUB — only README.md, no implementation
├── packages/             Internal TypeScript libraries (npm workspaces)
│   ├── ai/               ChatService, cognitive core, prompt builder, inference
│   ├── cognition/        Reasoning engine, intent/strategy plugins
│   ├── logger/           Structured runtime logging
│   ├── memory/           SQLite repositories, memory pipeline, retrieval, reflection
│   ├── personality/      Identity, emotions, mood, interests, experiences
│   ├── shared/           Shared interfaces, types, event bus
│   └── voice/           Voice interface layer (STT/TTS)
├── services/
│   └── arcon-inference/  Python FastAPI inference service (Qwen3-4B + LoRA)
│       ├── main.py       Inference server
│       ├── smoke-test.js Node.js integration smoke test
│       ├── requirements.txt
│       └── README.md
├── training/             Python training/eval scripts, datasets, adapters
│   ├── scripts/          ~30 training, dataset, eval scripts
│   ├── configs/          Training configuration files
│   ├── datasets/         Arcon V1 dataset (sources/, train.jsonl, validation.jsonl)
│   └── outputs/          Adapters, checkpoints, evaluation reports
├── docs/                 Architecture docs, specs, audits
├── tests/                Empty (tests live in packages/*/tests/)
├── .env                  Runtime environment (gitignored)
├── .env.example          Template for .env
├── .gitignore
├── package.json          Root workspace manifest
├── tsconfig.json         Root TypeScript config
├── tsconfig.base.json    Shared TSConfig (extended by all packages)
└── node_modules/
```

### Workspace configuration

- Root `package.json` (lines 7–10): npm workspaces `apps/*` and `packages/*`.
- Build order (hardcoded in `package.json` line 12): `shared → logger → memory → personality → cognition → ai → voice → server`.
- `@arcon/server` depends on `@arcon/ai`, `@arcon/logger`, `@arcon/memory`, `@arcon/shared`, `express`, `dotenv`.
- `@arcon/server` does NOT directly depend on `@arcon/personality` or `@arcon/cognition`; those are pulled transitively via `@arcon/ai`.

### CI/CD

- `.github/workflows/ci.yml`: On push/PR to `main`, runs `npm ci`, `npm test`, `npm run build` on `ubuntu-latest`, Node.js 20.x.
- No CI pipeline for training or Python inference. Evaluation is manual.

### Unused stubs

- `apps/chat/` — only contains a `data/` folder with stale SQLite files. No source code.
- `apps/desktop/` — only contains a `README.md`. No implementation.

---

## 2. Production Chat Entrypoint

### Startup sequence (`apps/server/src/index.ts`)

1. **Line 12–13**: Load `.env` from repo root via `dotenv`.
2. **Line 15**: `loadConfig()` reads env vars (`apps/server/src/config.ts`).
3. **Line 16**: `createLogger(config.logsDir)` — logger writes to `<dataDir>/logs/`.
4. **Line 17**: `new EventBus()` — in-memory event bus from `@arcon/shared`.
5. **Line 18**: `createConversationMemory(config.memoryDatabasePath)` — opens `ConversationStore` over `conversation.sqlite`.
6. **Lines 23–57**: Select inference backend:
   - **Default (`arcon-lora`)**: Creates `ArconLoRAProvider` and calls `getRuntimeIdentity()` against the Python service to learn the active adapter. Falls back to a default identity if the service is unreachable.
   - **Fallback (`ollama`)**: Creates `OllamaClient` with `OllamaClientOptions`.
7. **Line 59**: `registerEventLogging(eventBus, logger)` — wires message/error event handlers.
8. **Lines 63–80**: `createApp({...})` builds the Express app with all dependencies injected.
9. **Lines 82–93**: `app.listen(config.port)` starts the server.

### Express endpoints (`apps/server/src/app.ts`)

| Method | Path | Handler |
|--------|------|---------|
| `GET`  | `/`          | Serves `public/index.html` |
| `GET`  | `/health`     | `{status: "ok"}` |
| `GET`  | `/model-info`  | Proxies `/v1/models` for arcon-lora backend; synthesizes static response for Ollama |
| `POST`  | `/chat`       | Main chat endpoint. Creates/reuses `ChatService` per conversation, calls `chatService.chat(message)` |

### `/chat` flow

```
POST /chat { message, conversationId? }
  → getChatService(conversationId)  // per-conversation Map, no eviction
  → chatService.chat(message)
  → JSON { reply, conversationId }
```

**Memory note**: ChatService instances accumulate in `chatServices` Map (app.ts line 85). No eviction policy; DB connections may leak for every distinct conversationId over the server's lifetime.

### `.env` configuration

```
PORT=3000
ARCON_INFERENCE_BACKEND=arcon-lora
ARCON_INFERENCE_BASE_URL=http://localhost:8000
ARCON_ADAPTER_NAME=arcon-v1
ARCON_ADAPTER_PATH=C:/Projects/Arcon/training/outputs/arcon-v1/adapter
ARCON_CONTEXT_LIMIT=12
ARCON_DATA_DIR=./data
HF_TOKEN=hf_...
```

---

## 3. LLM Runtime Path (Node.js)

### `ChatService` (`packages/ai/src/chat-service.ts`)

`ChatService.chat()` performs the following steps (line numbers from current working tree):

1. **Persist user message**: `ConversationContext` (in-memory ring buffer, last 20 turns) + `ConversationStore` (SQLite).
2. **Decay engines**: `emotionEngine.decay()`, `interestEngine.decay()`.
3. **Mood update**: `moodEngine.recordUserTurn(message)`.
4. **Experience classification**: `classifyExperience(message)` — regex-based. Identity questions bump frustration.
5. **Interest update**: `interestEngine.updateFromText(message)`.
6. **Intent classification**: `classifyIntent(message)` → `USER_PROFILE | ARCON_IDENTITY | GENERAL`.
7. **Memory retrieval**: `analyzeQuestion()` → `MemoryRetriever` → `selectContext()` — pulls relevant memories, entities, past conversations.
8. **Context snapshot**: `buildContextSnapshot()` — builds structured `ContextSnapshot` for cognitive adapter.
9. **Deferred memory extraction**: If message does not end in `?`, kick off `LlmMemoryExtractor.extract()` as a `Promise` (deferred, awaited later). **This calls the LLM again** for extraction.
10. **System prompt assembly**:
    - `buildIdentityPrompt()` from `@arcon/personality/identity`
    - `buildRelationshipPrompt()` from `@arcon/personality/relationship`
    - `buildBehaviorPrompt({moodLabel, emotions, mood, interests, arconInterests})` from `@arcon/personality/mood/behavior-prompt.ts`
11. **Recent conversation history**: Last 20 turns from `ConversationContext`.
12. **Cognitive processing**: `cognitiveAdapter.process(input)` — runs `@arcon/cognition` `ReasoningPipeline` with `IntentPlugin` and `StrategyPlugin`. Gracefully degrades if cognition package throws.
13. **Two paths**:
    - **If clarification needed**: Builds a clarification prompt, calls `aiClient.generateReply()`, then fire-and-forget `processMemoryExtraction()`.
    - **Otherwise**: Concatenates system prompt with hard-coded "RUNTIME CAPABILITIES" block, then runs `PromptBuilder.build()`.
14. **Model call**: Wraps the prompt as a single `system` role `ChatMessage` and calls `aiClient.generateReply(messages)`.
15. **Post-processing**: `stripThinkTokens()` strips Qwen3 think tokens. `processAssistantResponse()` records the reply into mood, emotion engine, interest engine, and `ConversationStore`.
16. **Memory extraction**: `processMemoryExtraction(memoryPromise, ...)` — awaits extraction, validates/normalizes via `SemanticValidator`/`SemanticNormalizer`, updates entity tracker/linker/knowledge builder, runs `pipeline.processCandidates()` or `pipeline.processMessage()`.

### `chatStream()` (lines 429–711)

Mirrors `chat()` using `aiClient.generateReplyStream()` if available. Nearly identical code (~280 lines of duplication).

### `AiClient` interface (`packages/shared/src/index.ts`)

```typescript
interface AiClient {
  generateReply(messages: ChatMessage[]): Promise<string>;
  generateReplyStream?(messages: ChatMessage[]): AsyncIterable<string>;
}
```

Two implementations:
1. **`OllamaClient`** (`packages/ai/src/index.ts` lines 38–149) — POSTs to `OllamaClient.baseUrl/api/chat` (Ollama native API).
2. **`ArconLoRAProvider`** (`packages/ai/src/inference/arcon-lora-provider.ts`) — POSTs to `baseUrl/v1/chat/completions` (OpenAI-compatible, served by Python service).

### Model call pattern

`ChatService` always calls `aiClient.generateReply([{ role: "system", content: fullPrompt }])` — a single system message containing the entire assembled prompt. The model ID sent in requests defaults to `"arcon-v1"` but is **not used for routing** by the Python service (which only uses the adapter loaded at startup).

### Two-model-call-per-turn cost

Every non-question turn triggers:
1. One `POST /v1/chat/completions` for the chat response.
2. One `aiClient.generateReply()` for memory extraction (via `LlmMemoryExtractor`).

On the Arcon LoRA path, this means **two Qwen3-4B + adapter inferences per turn**.

---

## 4. Model Currently Used by Node.js Runtime

### Answer: Qwen/Qwen3-4B + Arcon V1 LoRA, served by the Python FastAPI service

The Node.js runtime is a **pure HTTP client**. It does NOT load any model weights itself.

- Default config: `ARCON_INFERENCE_BACKEND=arcon-lora` (`.env`).
- `ArconLoRAProvider` posts to `http://localhost:8000/v1/chat/completions`.
- The Python service (`services/arcon-inference/main.py`) loads the model and adapter at startup.
- Default adapter: `ARCON_ADAPTER_PATH=C:/Projects/Arcon/training/outputs/arcon/v1/adapter` (from `.env`).
- Base model: `Qwen/Qwen3-4B` (4-bit NF4 quantization via BitsAndBytesConfig).

### LoRA loading path (Python)

```python
# services/arcon-inference/main.py lines 118-134
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen3-4B",
    quantization_config=bnb_config,   # 4-bit NF4
    device_map="cuda",
    dtype=torch.float16,
)

if ADAPTER_PATH and os.path.isdir(ADAPTER_PATH):
    model = PeftModel.from_pretrained(model, ADAPTER_PATH, inference_mode=True)
    model.eval()
else:
    # base model only, no adapter
```

### Can Node.js load LoRA adapters?

**No — directly.** The Node.js runtime has no in-process LLM stack. No `transformers`, `torch`, `llama.cpp`, `node-llama`, or any native ML bindings. The `ArconLoRAProvider` only:

1. Calls `GET /v1/models` at startup via `getRuntimeIdentity()` to verify the Python service reports the adapter is loaded (`adapterActive`).
2. Calls `POST /v1/chat/completions` for chat generation.
3. Calls `generateReplyStream` for streaming (OpenAI-compatible SSE).

Switching adapters requires **restarting the Python service** with a different `ARCON_ADAPTER_PATH`. The Node.js runtime passes `model: "arcon-v1"` in the OpenAI request body, but `main.py` ignores it for routing (line 234: `model_id = f"arcon-{ADAPTER_NAME or 'base'}"`).

### Existing adapters

| Adapter | Location | Configuration | Status |
|---------|----------|---------------|--------|
| Arcon V1 | `training/outputs/arcon-v1/adapter/` | Qwen3-4B, NF4, LoRA r=8, alpha=16, dropout=0.05 | **Active runtime** (in `.env`) |
| Arcon V2 | `training/outputs/arcon-v2/adapter/` | Qwen3-4B, NF4, LoRA r=8, alpha=16, dropout=0.05 | Trained, not active |

V1 training config: 226 train examples, 84 validation, 3 epochs, lr=2e-4, seq_len=128.
V2 training config: 237 train examples, 91 validation, 3 epochs, checkpoint every 50 steps.

---

## 5. Ollama Integration

- Config key: `ARCON_INFERENCE_BACKEND` defaults to `"arcon-lora"` (`config.ts` line 22). Ollama is the **fallback**.
- Ollama env vars: `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.2`).
- Implementation: `OllamaClient` in `packages/ai/src/index.ts` (lines 38–149). Uses Ollama's native `/api/chat` endpoint (NOT OpenAI-compatible). Supports streaming.
- `/model-info` endpoint returns synthetic metadata for Ollama (`app.ts` lines 60–72).
- If the user switches to Ollama, the model defaults to `llama3.2` (not Qwen) — a generic model with no Arcon adapter.

---

## 6. Python Inference Service

### `services/arcon-inference/main.py` (298 lines)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | `{status: "ok", model_loaded: bool}` |
| `GET`  | `/v1/models` | OpenAI-style model list with Arcon extensions |
| `POST`  | `/v1/chat/completions` | OpenAI-compatible chat completion (streaming + non-streaming) |

### Model info (`/v1/models` response)

```json
{
  "id": "arcon-arcon-v1",
  "base_model": "Qwen/Qwen3-4B",
  "adapter_name": "arcon-v1",
  "adapter_path": "C:/Projects/Arcon/training/outputs/arcon-v1/adapter",
  "adapter_version": "rank-8",
  "inference_backend": "PEFT/Transformers",
  "gpu_memory": {"allocated_MB": 0, "reserved_MB": 0},
  "loaded_at": "2026-08-22T..."
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCON_BASE_MODEL` | `Qwen/Qwen3-4B` | Hugging Face model ID |
| `ARCON_ADAPTER_PATH` | `""` | Path to LoRA adapter directory |
| `ARCON_ADAPTER_NAME` | `""` | Adapter name for metadata |
| `ARCON_INFERENCE_HOST` | `127.0.0.1` | Bind host |
| `ARCON_INFERENCE_PORT` | `8000` | Bind port |
| `ARCON_MAX_NEW_TOKENS` | `512` | Max generation length |
| `ARCON_TEMPERATURE` | `0.7` | Sampling temperature |
| `ARCON_TOP_P` | `0.9` | Top-p sampling |
| `ARCON_REPETITION_PENALTY` | `1.1` | Repetition penalty |

### Other files in `services/arcon-inference/`

- `smoke-test.js` — 314 lines. Starts Python inference service + Node.js server, runs 10 identity/behavioral prompts, reports pass/fail. Uses hardcoded paths to `training/.venv` and `training/outputs/arcon-v1/adapter`.
- `requirements.txt`: fastapi, uvicorn, torch, transformers, peft, bitsandbytes, accelerate, sentencepiece, protobuf, optimum, pydantic.
- `.venv/` — Python virtual environment (gitignored).

---

## 7. Training Scripts

`training/scripts/` contains 28 scripts:

### Training
- `train_arcon_v1.py` — Original V1 trainer
- `train_arcon_v1_minimal.py` — Minimal V1 trainer (likely simplified version)
- `train_arcon_v1_dry_run.py` — Dry run for testing
- `train_arcon_v2.py` — V2 trainer with checkpoint/resume (725 lines)

### Dataset assembly
- `assemble_arcon_dataset_v1.py` — Builds `train.jsonl` + `validation.jsonl` from category sources
- `add_multiturn_batch1.py` through `add_multiturn_batch6.py` — Multi-turn data expansion
- `add_general_capability.py`, `add_general_capability_batch2.py`, `add_general_capability_replacement.py` — General capability data
- `apply_cognitive_cleanup.py` — Apply cognitive cleanup rules
- `fix_therapy_speak.py` — Fix therapy-speak in dataset
- `remove_meta.py` — Remove metadata from dataset

### Evaluation
- `evaluate_arcon.py` — Unified comparator (loads model + optional adapter, runs evaluation prompts)
- `evaluate_qwen3_baseline.py` — Baseline-only eval
- `create_eval_prompts.py` — Evaluation prompt builder
- `generate_evaluation_report.py` — Markdown report generator
- `baseline_smoke_test.py` — Quick smoke test

### Diagnostic/smoke
- `test_gpu_load.py` — GPU memory/load test
- `test_lora_training.py` — LoRA training test
- `benchmark_lora_configs.py` — LoRA config benchmark
- `chat_arcon_v1.py` — Interactive chat with V1 adapter

### Dataset

`training/datasets/arcon_v1/`:
- `train.jsonl` (226 examples) + `validation.jsonl` (84 examples)
- `sources/` — 7 category files: `identity.jsonl`, `cognition.jsonl`, `emotion.jsonl`, `curiosity.jsonl`, `memory.jsonl`, `personality.jsonl`, `anomalies.jsonl`
- `dataset_manifest.json` — Summary: 328 total, 7 categories, difficulty distribution
- `README.md`

### Outputs

```
training/outputs/
├── arcon-v1/
│   ├── adapter/          # adapter_config.json, adapter_model.safetensors (gitignored)
│   ├── training-config.json
│   ├── training-report.md
│   ├── training-log.txt
│   └── arcon-v1-behavioral-evaluation.md
├── arcon-v2/
│   ├── adapter/           # V2 adapter (gitignored weights)
│   ├── training-config.json
│   ├── training-report.md
│   ├── training_log.txt
│   ├── training_status.json
│   └── checkpoints/       # checkpoint-epoch{1-3}-step{50,100,150,200,237}
├── baseline/
│   └── qwen3-4b-baseline-report.md
└── evaluation/
    ├── arcon-v1.jsonl
    ├── arcon-v2-epoch2.jsonl
    ├── arcon-v2-epoch3.jsonl
    ├── baseline.jsonl
    └── arcon-v2-comparison.md
```

### Training configuration

| Parameter | V1 | V2 |
|-----------|----|----|
| Base model | Qwen/Qwen3-4B | Qwen/Qwen3-4B |
| Quantization | 4-bit NF4 | 4-bit NF4 |
| LoRA rank (r) | 8 | 8 |
| LoRA alpha | 16 | 16 |
| LoRA dropout | 0.05 | 0.05 |
| Target modules | q/k/v/o_proj, gate/up/down_proj | Same |
| Sequence length | 128 | 128 |
| Batch size | 1 | 1 |
| Learning rate | 2e-4 | 2e-4 |
| Epochs | 3 | 3 |
| Train examples | 226 | 237 |
| Validation examples | 84 | 91 |

---

## 8. Evaluation Scripts

- `evaluate_arcon.py` — Unified comparator. Loads model + optional adapter with 4-bit NF4; iterates over evaluation prompts; outputs JSONL results + timing/VRAM aggregates.
- `evaluate_qwen3_baseline.py` — Same loader for base Qwen3 only.
- `create_eval_prompts.py` — Generates the evaluation prompt file.
- `generate_evaluation_report.py` — Produces markdown reports.
- `baseline_smoke_test.py` — Quick smoke test.
- Output files in `training/outputs/evaluation/`: `baseline.jsonl`, `arcon-v1.jsonl`, `arcon-v2-epoch2.jsonl`, `arcon-v2-epoch3.jsonl`, `arcon-v2-comparison.md`.

### No automated Arcon-specific evaluation suite

**No evaluation harness exists at the runtime level for the Arcon-specific evaluation categories (identity, memory, personality, emotion, etc.).** All evaluation is Python-driven and manually re-run against saved adapters. The Node.js test suite uses mocked `AiClient` implementations and does not test actual LLM behavior.

---

## 9. Prompt Builder

`packages/ai/src/prompt-builder.ts` (155 lines). Section order:

1. `SYSTEM:` + systemPrompt (from ChatService)
2. Optional `RUNTIME IDENTITY:` (only if `input.runtimeIdentity` provided)
3. Optional `RUNTIME CAPABILITIES:` (only if `input.capabilities` provided)
4. Optional `RESPONSE STRATEGY:` (from CognitiveDecision)
5. Optional `CLARIFICATION REQUIRED:` (when `cognitiveDecision.clarificationNeeded`)
6. Optional `UNRESOLVED CONFLICTS:`
7. Optional `RESPONSE MODE: DEFER`
8. Context-driven sections:
   - `ARCON IDENTITY:` (if context selection includes it)
   - `CURRENT STATE:` (emotion state)
   - `USER INTERESTS:` / `ARCON INTERESTS:` (depending on subject)
   - `USER CONTEXT:`
   - `PROJECT CONTEXT:`
9. `RELEVANT MEMORIES:` — from MemoryRetriever
10. `RELEVANT PAST CONVERSATION:` (last 8 lines)
11. `CONVERSATION:` — recent conversation history
12. `USER:` — current message

### Discrepancy: RuntimeIdentity not injected

`ChatService` receives a `RuntimeIdentity` via constructor (`arcon-lora-provider.ts` line 2, `chat-service.ts` line 73 imports `RuntimeIdentity`). The identity is fetched from `/v1/models` at server startup. However, `ChatService.chat()` **never passes `runtimeIdentity` or `capabilities`** to `PromptBuilder.build()` — both fields are optional in `PromptBuildInput` and are omitted. The only runtime info the model sees is a hard-coded string:

```typescript
// chat-service.ts lines 378–382 (and 619–621)
const runtimeCapabilities = `
Arcon is running locally with SQLite-backed persistent memory.
Arcon does not have web search, file system access, or external tool execution in this runtime.
`;
```

This means the model never sees which base model, adapter version, GPU memory, or adapter state is actually loaded.

---

## 10. Memory Systems

`packages/memory/src/` — full personal memory engine:

### Tables (personal-memory.sqlite)

| Table | Purpose |
|-------|---------|
| `personal_memories` | Durable memories (FACT, PREFERENCE, PROJECT, GOAL, RELATIONSHIP, CONSTRAINT) |
| `emotions` | 5 emotional dimensions (curiosity, trust, happiness, confidence, frustration) |
| `interests` | User interests |
| `arcon_interests` | Arcon's own self-interests |
| `memory_audit_log` | Memory mutation audit trail |

### Memory lifecycle states

`ACTIVE`, `ARCHIVED`, `OBSOLETE`, `CONTRADICTED`, `PENDING_CONFIRMATION`, `SUPERSEDED`

### Flow: extraction → storage → retrieval

```
User message
  → LlmMemoryExtractor (calls LLM for JSON extraction)    [packages/ai/src/semantic-memory/]
  → SemanticValidator + SemanticNormalizer
  → ConversationEntityTracker.update, EntityMemoryLinker.link, EntityKnowledgeBuilder.build
  → MemoryPipeline.processCandidates (rule-based second pass via MemoryExtractor)
    → reviewCandidate: CREATE / UPDATE / CONFLICT / SUPERSEDE / IGNORE
  → MemoryRepository (persist to SQLite)
  → MemoryRetriever (retrieve on next turn)
  → ContextSnapshot
  → PromptBuilder
  → Model
```

### Key types

- `MemoryCandidate` — type, content, importanceScore, confidenceScore, sourceType
- `MemorySourceType` — USER_EXPLICIT, USER_CONFIRMED, INFERRED, SYSTEM_OBSERVED
- `MemoryScope` — USER, ARCON, PROJECT, ENTITY, CONVERSATION
- `supersedesId` — links to replaced memory (lineage preserved)

---

## 11. Emotion Systems

`packages/personality/src/emotion/` and `packages/personality/src/mood/`:

### EmotionEngine (`emotion-engine.ts`)

- Tracks 5 emotions: curiosity, trust, happiness, confidence, frustration
- Each has a value (0–1) with decay and transition logic
- Persisted to `MemoryRepository` (`emotions` table in `personal-memory.sqlite`)

### EmotionManager (`emotion-manager.ts`, 254 lines)

- Extends `EmotionEngine`
- `recordAssistantTurn(reply)` — detects Arcon emotional event via regex on its own replies
- `recordUserTurn(message)` — delegates to `UserEmotionDetector`

### UserEmotionDetector (`user-emotion-detector.ts`)

- Regex-based detection of: preferences, excitement, frustration, success, trust, opinion requests
- Rejects long-distance nonsensical patterns, unrelated keywords, negative-only statements

### MoodEngine (`mood-engine.ts`, 280 lines)

- Derives `MoodCategory` from emotional state
- Tracks: frustration, askCount, pendingQuestion, trust, excitement, intensity, cause
- Persisted to `MoodRepository` → `mood.sqlite`
- Influences behavior via `behavior-prompt.ts` which generates mood-based guidance

### How mood influences conversation

- `MoodEngine.recordAssistantReply()` counts assistant questions, sets `pendingQuestion`
- `MoodEngine.recordUserTurn()` decreases askCount on positive engagement, increases frustration on ignored questions
- Mood category drives guidance sentences in the system prompt (e.g., "FRUSTRATED: Keep replies shorter")
- "Ask Count" guidance tells the model to throttle follow-up questions

---

## 12. Personality Systems

`packages/personality/src/`:

### Identity (`identity/`)

- `arcon-identity.ts` — Hardcoded `ARCON_IDENTITY` constant (name, creator, version, purpose, traits, core rules)
- `identity-builder.ts` — `buildIdentityPrompt()` assembles the identity prompt section

### Relationship (`relationship/`)

- `relationship-profile.ts` — Hardcoded `ARCON_RELATIONSHIP` constant
- `relationship-builder.ts` — `buildRelationshipPrompt()`

### Behaviour (`mood/behavior-prompt.ts`)

- Converts mood + emotions + interests into a behavior state block
- Always present in system prompt (3rd section)

### Experience (`experience/`)

- `experience-manager.ts`, `experience-repository.ts`, `experience-type.ts`
- 40 experience types tracked (USER_ASKED_IDENTITY, ARCON_ASKED_QUESTION, etc.)
- Persisted to `experiences.sqlite`

### Interest (`interest/`)

- `interest-engine.ts`
- Separates user interests from Arcon self-interests
- Persisted in `MemoryRepository` (`interests` and `arcon_interests` tables)
- Decay over time
- Updated from both user messages and assistant replies (but never cross-fed)

---

## 13. Entity Systems

`packages/memory/src/entity/` and `packages/memory/src/conversation/`:

### EntityRepository (`entity-repository.ts`, 357 lines)

- SQLite tables: `entities`, `entity_links`
- CRUD for named entities (people, pets, projects, places)

### Entity knowledge

- `entity-fact-extractor.ts`, `entity-fact-repository.ts`, `entity-fact.ts` — per-entity facts
- `entity-memory-linker.ts` — links memory candidates to entities
- `entity-knowledge-builder.ts` — builds entity-level knowledge from memories
- `entity-relationship-extractor.ts` — extracts family-style relationships (father, mother, sister, brother, self)

### Conversation entity tracking

- `conversation-entity-tracker.ts` — tracks active entity per conversation via `getActiveEntity()`
- `conversation-entity.ts` — entity type used within conversation context

### Entity flow

```
LlmMemoryExtractor.extract(message, activeEntity)
  → ConversationEntityTracker.update(memories)
  → EntityMemoryLinker.link(memories)
  → EntityKnowledgeBuilder.build(memories)
```

---

## 14. Tool System

**No tool-calling infrastructure exists.** Confirmed by:

1. `AiClient` interface only has `generateReply` and `generateReplyStream` — no `tools` or `tool_calls` schema.
2. Python `ChatCompletionRequest` accepts standard fields but does not process `tools` or `tool_choice`.
3. `ChatService.chat()` always builds a single `system` role message — no tool execution path.
4. `RuntimeCapabilities` explicitly marks `web access`, `screen awareness`, `computer control` as `NOT_IMPLEMENTED`.
5. Hard-coded string in chat-service.ts: "Arcon does not have web search, file system access, or external tool execution in this runtime."

---

## 15. Conversation History

### `ConversationStore` (`packages/memory/src/conversation-store.ts`, 375 lines)

SQLite schema:
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  topics TEXT,
  summary TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}'
);
```

Methods: `createConversation`, `storeMessage`, `getMessages`, `getRecentMessages`, `searchMessages` (LIKE-based), `searchConversations`, `getRelevantConversationHistory`, `updateConversationSummary`.

### `ConversationContext` (in-memory)

- `packages/ai/src/conversation-context.ts` — maintains last 20 turns per conversation in memory
- Lost on server restart (not persisted)
- Used directly for prompt generation

### Live database files

- `data/memories/conversation.sqlite` — conversation storage
- `data/memories/personal-memory.sqlite` — personal memories, emotions, interests
- `data/mood/mood.sqlite` — mood state
- `data/experiences/experiences.sqlite` — experience tracking
- `data/entities/entities.sqlite` — entity graph

---

## 16. Key Findings

### 1. What model does the REAL Node.js runtime currently use?

**Qwen/Qwen3-4B + Arcon V1 LoRA**, served by the Python FastAPI service at `http://localhost:8000`.

The Node.js runtime is a pure HTTP client. It never touches model weights. The actual model loading and LoRA application happens in `services/arcon-inference/main.py`. The default `.env` selects `arcon-lora` backend pointing to `training/outputs/arcon-v1/adapter`.

### 2. Can the Node.js runtime actually use the LoRA adapters?

**No — not directly.** The Node.js side has no in-process LLM stack. The `ArconLoRAProvider` class is an OpenAI-compatible HTTP client that:
- Calls `GET /v1/models` at startup to verify the adapter is active (via `getRuntimeIdentity()`).
- Calls `POST /v1/chat/completions` for inference.
- Returns a `RuntimeIdentity` object with `adapterActive`, `baseModel`, `adapterName`, `adapterVersion`, `gpuMemoryAllocatedMB`, etc. — but **this identity is never injected into the model prompt**.

Switching adapters requires restarting the Python service with a different `ARCON_ADAPTER_PATH`.

### 3. Discrepancies

| Discrepancy | Detail | Impact |
|-------------|--------|--------|
| RuntimeIdentity fetched but not injected | `getRuntimeIdentity()` runs at startup, result threaded through ChatService, but PromptBuilder.build() omits both `runtimeIdentity` and `capabilities` | Model never sees actual adapter/model/GPU state |
| RuntimeCapabilities defined but unused | `DEFAULT_CAPABILITIES` in `runtime-capabilities.ts` exists and is re-exported, but ChatService uses a hard-coded string instead | Structured capability data never reaches the model |
| No streaming endpoint exposed | `chatStream()` exists in ChatService but `app.ts` only exposes non-streaming `POST /chat` | Streaming infrastructure unused |
| Two model calls per turn | Memory extraction uses the same LLM as chat response | Double inference cost per turn |
| No tool infrastructure | AiClient has no tool schema; no execution path | No tool calling possible |
| Memory extraction uses raw LLM output without grounding | Extraction prompt produces JSON arrays; no runtime verification of extracted memories | Inconsistent extraction (known issue from prior audit) |
| Mood decay not functioning at runtime | Decay logic exists but may not trigger correctly during live conversation (documented in prior audit) | Mood state may not evolve as expected |
| ConversationContext lost on restart | In-memory ring buffer, not persisted to SQLite | Recent context lost on server restart |
| ChatService instances accumulate | Per-conversation Map with no eviction policy | Potential DB connection leak over time |

### 4. Hardware constraint

- Development machine: NVIDIA RTX 3050 Laptop GPU, 6 GB VRAM, ~16 GB system RAM.
- Qwen3-4B in 4-bit NF4 fits in 6 GB VRAM.
- Qwen3.5-9B and larger models likely **will not** fit without CPU offloading.

### 5. What works well

- All external cognitive systems (memory, emotion, personality, entity, experience, curiosity) are functional and tested.
- All 305 automated tests pass.
- All 8 workspace packages build successfully.
- The Python inference service correctly loads Qwen3-4B + V1 LoRA adapter.
- SQLite persistence works across Node.js restarts.
- Supersion, conflict, and lifecycle states are enforced.
- The architecture enforces the principle: "memory remembers, the model communicates."

### 6. Architecture principle confirmed

The architecture correctly externalizes all persistent state (memory, emotion, personality, identity, interests, relationships, entities, experiences) to software systems. The LLM is the communication layer only. No runtime state is "baked into" model weights.

---

## Appendix: Key File Paths

### Production entrypoints
- `apps/server/src/index.ts:12-13` — env loading
- `apps/server/src/config.ts:16-34` — config loading
- `apps/server/src/app.ts:102-127` — POST /chat handler
- `packages/ai/src/chat-service.ts:183-427` — ChatService.chat()
- `packages/ai/src/prompt-builder.ts` — PromptBuilder.build()
- `services/arcon-inference/main.py:99-136` — model + adapter loading

### Model configuration
- `.env` — runtime env (gitignored, not committed)
- `.env.example` — template
- `services/arcon-inference/main.py:36-44` — Python env vars
- `apps/server/src/config.ts:16-34` — server-side env vars

### Training
- `training/scripts/train_arcon_v2.py` — V2 trainer
- `training/scripts/evaluate_arcon.py` — evaluation harness
- `training/datasets/arcon_v1/` — V1 dataset
- `training/outputs/arcon-v1/adapter/adapter_config.json` — V1 adapter config
- `training/outputs/arcon-v2/adapter/adapter_config.json` — V2 adapter config
