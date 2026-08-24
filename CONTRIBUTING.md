# Contributing to Arcon

Thank you for your interest in contributing to Arcon.

Arcon is a local-first AI companion with modular cognitive architecture. Contributions are welcome, but this project has strong architectural constraints. Please read this guide before opening a pull request.

## Project Overview

Arcon treats memory, emotion, experience, reflection, and reasoning as independent software systems. The LLM is the communication layer — not the source of truth.

Current architectural phases:
- Phase A — Runtime Convergence (complete)
- Phase B — Memory Lifecycle (complete)
- Phase C — Retrieval + Context Selection (complete)
- Phase D — Cognitive Core (complete)
- Phase E — Reflection + Consolidation (complete)

## Development Setup

### Prerequisites

- Node.js >= 20
- npm
- Python 3.11+ (for local inference service)
- NVIDIA GPU with CUDA (for inference)

### Install Dependencies

```bash
npm install
```

### Build All Workspaces

```bash
npm run build
```

### Run Tests

```bash
# Run all tests across workspaces
npx tsx --test "packages/*/tests/**/*.test.ts" "apps/*/tests/**/*.test.ts"

# Or run tests for a specific workspace
npm test -w @arcon/memory
npm test -w @arcon/ai
npm test -w @arcon/personality
npm test -w @arcon/voice
```

### Run the Project

Terminal 1 — Python inference service:

```powershell
$env:ARCON_BASE_MODEL = "Qwen/Qwen3-4B"
$env:ARCON_ADAPTER_PATH = "training/outputs/arcon-v1/adapter"
$env:ARCON_ADAPTER_NAME = "arcon-v1"
python services/arcon-inference/main.py
```

Terminal 2 — Node.js runtime:

```powershell
$env:ARCON_INFERENCE_BACKEND = "arcon-lora"
$env:ARCON_INFERENCE_BASE_URL = "http://127.0.0.1:8000"
$env:ARCON_ADAPTER_NAME = "arcon-v1"
npm start
```

## Repository Structure

```
apps/
  server/           # Canonical Express runtime
  desktop/          # Desktop UI (out of scope)

packages/
  ai/               # Chat orchestration, cognitive core, prompt building
  cognition/        # Reasoning engine, intent plugins, strategy plugins
  logger/           # Structured runtime logging
  memory/           # SQLite repositories, memory pipeline, retrieval, reflection
  personality/      # Identity, emotions, mood, interests, experiences
  shared/           # Shared interfaces and common types
  voice/            # Voice interface layer (STT/TTS)

services/
  arcon-inference/  # Python FastAPI inference service

training/           # LoRA/QLoRA training scripts and datasets
docs/               # Architecture, design decisions, specifications
```

## How to Contribute

### Reporting Bugs

Use the GitHub issue tracker. Include:
- Environment (OS, Node version, Python version, GPU)
- Arcon version/commit
- Reproduction steps
- Expected vs actual behavior
- Relevant logs or error output
- Runtime configuration (redact secrets)

### Suggesting Features

Use the GitHub issue tracker. Include:
- Problem statement
- Proposed solution
- Alternatives considered
- Architectural impact on memory, retrieval, cognition, or reflection

### Architecture Discussions

Use the GitHub issue tracker with the `architecture` label. Include:
- Problem
- Current architecture
- Proposed change
- Tradeoffs
- Memory/retrieval/cognitive implications

### Pull Requests

1. Fork the repository and create a feature branch.
2. Make your changes.
3. Add tests for new behavior. Tests should cover both positive and negative cases.
4. Ensure all existing tests pass.
5. Update documentation if the change affects architecture or behavior.
6. Submit a pull request using the PR template.

## Pull Request Expectations

- Keep changes focused and reviewable.
- Do not combine unrelated changes in one PR.
- Do not introduce new architectural phases or major subsystems without prior discussion.
- Do not add vector databases, graph databases, or chain-of-thought exposure.
- Do not bypass existing memory lifecycle rules.
- Do not add model training runs or large artifacts.

## Architecture Considerations

Contributors should understand the following principles:

- **Memory lifecycle is authoritative.** All memory changes must flow through `MemoryPipeline`.
- **Retrieval distinguishes relevance from validity.** Invalid or stale memories must be excluded from normal retrieval.
- **Memory scope matters.** Scope filtering is enforced at the retrieval level.
- **ContextSnapshot is structured internal state.** It is not raw context exposed to the model.
- **CognitiveDecision is structured cognitive output.** It is not exposed chain-of-thought.
- **Reflection must go through the memory lifecycle.** Reflection proposes; `MemoryPipeline` decides.
- **The LLM is not the database, memory manager, personality manager, or source of truth.**

## Documentation Expectations

- Update README.md if the change affects user-facing behavior.
- Update `docs/architecture.md` if the change affects architecture.
- Update `docs/decisions.md` if the change introduces or modifies an architectural decision.
- Update `docs/CHANGELOG.md` for user-visible changes.

## Commit Expectations

- Write clear, descriptive commit messages.
- Reference issue numbers when applicable.
- Do not commit secrets, local runtime data, or generated artifacts.

## Code of Conduct

This project follows the Contributor Covenant. Be respectful and constructive.
