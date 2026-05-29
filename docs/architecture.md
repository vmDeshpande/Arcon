# Architecture

Phase 1 is a modular Node.js backend.

- `apps/server` exposes HTTP endpoints.
- `packages/ai` owns Ollama communication.
- `packages/memory` owns short-term SQLite conversation storage.
- `packages/logger` writes timestamped JSON logs.
- `packages/shared` contains cross-package types, interfaces, and the event bus.

The chat request path is:

1. `POST /chat` receives text.
2. Server emits `MESSAGE_RECEIVED`.
3. User message is stored in SQLite.
4. Server retrieves recent conversation messages.
5. Ollama generates a reply.
6. Assistant reply is stored in SQLite.
7. Server returns the reply.

No long-term memory, personality system, screen awareness, automation, or proactive behavior exists in Phase 1.
