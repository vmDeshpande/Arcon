# Decisions

## Phase 1 scope

Only the text chat foundation is implemented. Future systems are intentionally excluded to keep the base stable.

## Storage

SQLite is used for short-term conversation history. The database is stored in `data/memories/conversation.sqlite`.

## AI provider

Ollama is accessed through its local `/api/chat` endpoint. The model is configurable with `OLLAMA_MODEL`.

## Logging

Logs are JSON lines written by date to `data/logs`. Event handlers perform logging so the request flow remains simple.
