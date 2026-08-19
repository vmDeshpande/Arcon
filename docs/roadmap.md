# Roadmap

## Phase 1: Foundation

- Text message input
- Ollama response generation
- Short-term conversation storage
- Recent context retrieval
- Event bus
- Timestamped logs

## Later Phases

The following are not part of Phase 1:

- Long-term memory
- Personality engine
- Screen awareness
- Browser or desktop automation
- Web learning
- Reflection systems
- Proactive behavior
- Electron frontend

## Voice V1 (interface layer)

Voice V1 adds a local-first voice interface that wraps the existing text path rather than replacing it:

- Microphone capture via ffmpeg (DirectShow on Windows)
- Speech-to-text via local `faster-whisper`
- Routing through the existing `ChatService`
- Text-to-speech via Windows Speech API (with an ffmpeg/flite fallback)

## Voice V2 (interface layer)

Voice V1 plus natural speech and lower latency, still wrapping the existing text path:

- **Natural voice:** local neural TTS via **Piper** (Windows SAPI / ffmpeg-flite as fallbacks). No cloud, no GPU.
- **Lower latency:** smaller end-of-speech silence tail (800 ms → 450 ms), STT model and TTS voice **pre-warmed** at startup, and per-turn latency instrumentation (`onTurnMetrics` / `VOICE_DEBUG`). New headline metric: `timeToFirstAudioMs` (speech-end → first spoken audio).

Planned voice improvements (not in V2): wake word, continuous listening, advanced voice activity detection, streaming STT/TTS, interruption/barge-in, emotional speech synthesis, and streaming the `ChatService` LLM response into the TTS (the remaining dominant latency source, gated on touching the Arcon core).
