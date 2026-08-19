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

1. `FFmpegMicrophoneRecorder` captures the microphone via `ffmpeg` (DirectShow on Windows). An adaptive `SilenceDetector` (RMS energy-based VAD) stops recording when speech ends, with a configurable silence timeout (default 300 ms) and minimum-speech-duration guard (default 400 ms) to prevent premature cutoff.
2. `WhisperSttRecognizer` transcribes to text using local `faster-whisper` (CPU). The Python worker is pre-warmed at startup and stays resident across turns.
3. The transcript is passed to the existing `ChatService`, which is the exact same path as text input. Voice V2 uses `ChatService.chatStream` when available, which streams the LLM response token-by-token and runs semantic memory extraction concurrently (fire-and-forget) to avoid blocking the response.
4. `PiperTtsSynthesizer` (default) or `WindowsSapiSynthesizer` (Windows fallback) / `FfmpegFliteSynthesizer` (cross-platform fallback) speaks the reply to the speakers. When streaming is available, tokens are buffered into complete sentences and each sentence is synthesized and played back in a pipelined fashion — synthesis of the next sentence overlaps with playback of the current one.

The existing text path is unchanged.

### Streaming pipeline

When `ChatService.chatStream` and `SpeechSynthesizer.speakStream` are both available, the voice service uses a streaming pipeline:

```
User stops speaking
   ↓
End-of-speech detection      (adaptive silence, ~300ms)
   ↓
STT (faster-whisper)          (~280ms, warm)
   ↓
ChatService.chatStream()
   ├── Memory extraction      (fire-and-forget, async)
   ├── LLM streaming           (first token ~3.5-10s on CPU)
   │     ↓
   │   Sentence buffer
   │     ↓
   │   Piper synthesis         (~200ms per sentence)
   │     ↓
   │   ▶️ Arcon speaks
   │     ↓
   │   Next sentence synthesizes while current plays
```

When streaming APIs are unavailable, the service transparently falls back to the synchronous `chat` + `speak` path.
