# @arcon/voice

A local-first voice interface layer for Arcon. It turns speech into text, feeds that text into Arcon's existing text processing path, and speaks Arcon's reply back through the speakers.

Voice is an **interface layer only**. It owns neither memory, personality, reasoning, LLM calls, nor conversation logic — it delegates all of that to Arcon's existing systems (`ChatService`, memory, personality, etc.).

```
 Micropone
     ↓
 Local STT (faster-whisper)
     ↓
 Text
     ↓
 Arcon ChatService / memory / personality / cognition
     ↓
 Text reply
     ↓
 Local TTS (Windows Speech API / ffmpeg flite)
     ↓
 Speaker
```

## Status: Voice V1

This is the first working voice loop. It supports a single push-to-record turn triggered from the CLI. The following are intentionally **not** implemented and are tracked for later phases:

- Wake word detection
- Continuous / background listening
- Advanced voice activity detection
- Multiple speakers
- Streaming STT / TTS
- Interruption / barge-in
- Emotional voice synthesis / voice cloning
- Cloud speech APIs

## Architecture

The package is split into three responsibilities, each behind a sealed interface so that the rest of Arcon never depends on a concrete implementation:

| Responsibility | Interface | Local implementation |
|---|---|---|
| Audio capture | `AudioRecorder` | `FFmpegMicrophoneRecorder` |
| Speech-to-text | `SpeechRecognizer` | `WhisperSttRecognizer` |
| Text-to-speech | `SpeechSynthesizer` | `WindowsSapiSynthesizer` (Windows) / `FfmpegFliteSynthesizer` (fallback) |

`VoiceService` wires the three together with an Arcon chat interface and orchestrates a turn:

```
listenAndRespond():
  1. record  (AudioRecorder.record)   -> AudioRecording
  2. transcribe (SpeechRecognizer.transcribe) -> Transcription
  3. chat     (ArconChat.chat)        -> reply text   (existing Arcon path)
  4. speak    (SpeechSynthesizer.speak) -> audio output
```

Every failure is caught and surfaced as a `VoiceError` with a structured `VoiceErrorCode`. The service never throws out of `listenAndRespond()` — it returns a `VoiceTurnResult` (`{ ok: true, ... }` or `{ ok: false, reason, message }`).

### Chosen implementations

**Speech-to-text** — `faster-whisper` running a persistent Python worker process.

- Runs entirely on the CPU; no GPU required.
- Models are downloaded once to the HuggingFace cache and reused offline thereafter.
- The Node process spawns a long-lived Python worker (so the model is loaded once and reused across turns), sends it a WAV file path per turn, and reads back JSON. The model (`tiny` by default) gives a good speed/accuracy trade-off for local CPU inference.
- The Python worker script is embedded in the recognizer and written to a temp file at runtime — no external `.py` files ship from the package root.

**Text-to-speech** — Windows Speech API (SAPI) via PowerShell, with an `ffmpeg` + `flite` fallback.

- On Windows, `WindowsSapiSynthesizer` uses `System.Speech.Synthesis` (ships with Windows) and plays directly to the default audio device. Zero extra install.
- Where SAPI is unavailable, `FfmpegFliteSynthesizer` uses ffmpeg's `flite` audio filter to render a WAV and `ffplay` to play it.
- The implementation is selected by the factory: `tts: "sapi" | "flite" | "auto"` (auto picks SAPI on Windows, flite elsewhere).

**Audio capture** — `FFmpegMicrophoneRecorder`.

- Captures the Windows microphone through ffmpeg DirectShow (`-f dshow`) using the device **path** (the `@device_cm_{...}` identifier) to avoid friendly-name quoting issues.
- Pipes raw 16-bit PCM (16 kHz, mono) from ffmpeg's stdout and applies a simple energy-based voice-activity check (`SilenceDetector`) to stop automatically when the user finishes speaking, with a configurable max-duration cap.

## Installation requirements (Windows)

Voice V1 is local-first but requires a few system dependencies. The repository itself adds no native Node bindings.

### Required

- **Node.js >= 20** (existing requirement)
- **ffmpeg + ffplay** (provides microphone capture and the flite fallback)
  - Scoop: `scoop install ffmpeg`
  - Or from <https://www.gyan.dev/ffmpeg/builds/> and add `ffmpeg`/`ffplay` to `PATH`.
- **Python 3.10+**
- **faster-whisper + ctranslate2** (local STT)
  ```bash
  pip install faster-whisper ctranslate2
  ```
  These install cleanly on Windows. A C++ compiler is **not** required because prebuilt `ctranslate2` wheels are used.

### Install the model (happens automatically on first use)

The first transcription downloads a quantized Whisper model to the HuggingFace cache (`%USERPROFILE%\.cache\huggingface`) and reuses it offline from then on. The default model is `tiny`. To suppress the harmless symlink warning on first run, enable Developer Mode or run:

```bash
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
```

### Verify your environment

```powershell
ffmpeg -version        # capture + flite fallback
ffplay -version        # audio playback for flite fallback (optional on Windows)
python -c "import faster_whisper; print(faster_whisper.__version__)"
```

> Windows SAPI needs no install. If SAPI is unavailable, the flite fallback needs `ffmpeg` **and** `ffplay`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Arcon LLM endpoint (unchanged from text mode). |
| `OLLAMA_MODEL` | `qwen3:1.7b` | Arcon LLM model (unchanged from text mode). |

These are the same variables the text chat uses — voice reuses the exact same `ChatService` path.

## How to start voice mode

Voice mode extends the existing chat CLI in `apps/chat`:

```bash
npm run dev:voice -w @arcon/chat
```

Then at the prompt:

```
Arcon Voice Mode
Press ENTER to speak, or type 'exit' to quit.
You (ENTER to speak):
```

Press `ENTER`, speak into the microphone, and Arcon will transcribe your speech, pass it through the existing `ChatService`, and speak the reply back through your speakers. Type `exit` to quit.

The text path is unchanged:

```bash
npm run dev -w @arcon/chat
```

## Programmatic use

```ts
import { createLocalVoiceService } from "@arcon/voice";

const voice = await createLocalVoiceService(chat, { logger });
await voice.start(); // warm up the STT model
await voice.listenAndRespond();
await voice.close();
```

`ArconChat` is the minimal contract injected into `VoiceService`; the existing `ChatService` satisfies it directly.

## Testing

The package unit tests use `node:test` with fakes (no microphone/LLM/speakers required):

```bash
npm test -w @arcon/voice
```

They cover: STT returns text, empty transcription is handled, text reaches the chat service, the chat reply reaches TTS, and STT / chat / TTS / recorder failures are all handled without crashing.

## Known limitations (Voice V1)

- Speech recognition runs per-turn on a CPU via `faster-whisper` (`tiny`); longer utterances add latency.
- Recording uses a simple energy threshold rather than advanced VAD; very quiet speakers or noisy rooms may need `recordOptions.energyThreshold` tuning.
- The flite fallback voice is lower quality than Windows SAPI.
- Only the default microphone input is used; device selection can be supplied via `recordOptions.deviceId`.
- No wake word — a turn is started on demand from the CLI.
