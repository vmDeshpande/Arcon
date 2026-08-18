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

## Voice interface layer (packages/voice)

Voice is an interface layer. It converts speech to text, routes the text through the **existing** Arcon processing path (`ChatService`, memory, personality), and speaks the reply back. It owns no memory, personality, reasoning, or LLM calls of its own.

The request path for a voice turn is:

1. `FFmpegMicrophoneRecorder` captures the microphone via `ffmpeg` (DirectShow on Windows).
2. `WhisperSttRecognizer` transcribes to text using local `faster-whisper` (CPU).
3. The transcript is passed to the existing `ChatService.chat`, which is the exact same path as text input.
4. `WindowsSapiSynthesizer` (Windows) or `FfmpegFliteSynthesizer` speaks the reply to the speakers.

The existing text path is unchanged.
