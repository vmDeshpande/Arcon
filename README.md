# Arcon

Arcon Phase 1 is a local-first foundation server for text chat through Ollama.

This phase only implements:

- Express API
- Ollama chat client
- SQLite-backed short-term conversation history
- Lightweight event bus
- File logging under `data/logs`

Future systems such as long-term memory, personality, screen awareness, automation, reflection, learning, and desktop UI are intentionally not implemented.

## Structure

```text
apps/
  desktop/        # Reserved for a later phase
  server/         # Express API
packages/
  ai/             # Ollama client
  logger/         # Timestamped file logger
  memory/         # Short-term SQLite conversation memory
  shared/         # Message types, interfaces, event bus
data/
  logs/           # Runtime logs
  memories/       # SQLite database
  profiles/       # Reserved for later phases
docs/
```

## Requirements

- Node.js 20+
- npm
- Ollama running locally
- An Ollama model pulled locally, for example:

```bash
ollama pull llama3.2
```

## Setup

```bash
npm install
copy .env.example .env
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Configuration

Set values in `.env`:

```bash
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
ARCON_CONTEXT_LIMIT=12
# Optional. Defaults to ./data at the repository root.
ARCON_DATA_DIR=./data
```

`ARCON_CONTEXT_LIMIT` controls how many recent messages are sent to Ollama as short-term context.

## API

### Health

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### Chat

```http
POST /chat
Content-Type: application/json
```

Request:

```json
{
  "message": "Hello"
}
```

Response:

```json
{
  "reply": "Hello, how can I help?",
  "conversationId": "..."
}
```

Pass the returned `conversationId` on later requests to continue the same short-term conversation:

```json
{
  "conversationId": "...",
  "message": "What did I just ask?"
}
```

## Events

The server emits:

- `MESSAGE_RECEIVED`
- `MESSAGE_STORED`
- `AI_RESPONSE_GENERATED`
- `ERROR_OCCURRED`

The logger subscribes to these events and writes timestamped JSON lines to `data/logs/YYYY-MM-DD.log`.
