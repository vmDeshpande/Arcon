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

Planned voice improvements (not in V1): wake word, continuous listening, advanced voice activity detection, streaming STT/TTS, interruption/barge-in, and emotional speech synthesis.
