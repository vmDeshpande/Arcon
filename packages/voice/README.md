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

## Status: Voice V2

Voice V2 keeps Voice V1's architecture (speech → existing `ChatService` → reply) and improves the two things that mattered most in V1:

1. **Natural, human-sounding speech.** The default TTS is now **Piper** — a lightweight, CPU-friendly neural vocoder using built-in English neural voices (e.g. `en_US-amy-medium`). Windows SAPI and the ffmpeg/flite fallback remain available when Piper isn't installed. No cloud, no GPU required.
2. **Lower perceived latency.** End-of-speech silence tail lowered (800 ms → 450 ms), the STT model and the Piper voice are **pre-warmed** at startup, and per-turn **latency is instrumented** so you can see exactly where time goes. Time-to-first-audio is reported per turn.

It still supports a single push-to-record turn triggered from the CLI. The following remain intentionally **not** implemented and are tracked for later phases:

- Wake word detection
- Continuous / background listening
- Advanced voice activity detection (beyond the energy threshold)
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

**Text-to-speech** — Piper neural voices by default (Windows SAPI and ffmpeg/flite as fallbacks).

- On Windows, `PiperTtsSynthesizer` runs a persistent Python worker (loads the voice once) and plays a synthesized WAV with `ffplay`. Piper uses quantized on-device neural models (default `en_US-amy-medium`); voices are local and require no GPU.
- Selection is via the factory: `tts: "piper" | "sapi" | "flite" | "auto"`. `auto` prefers Piper (if installed), then Windows SAPI, then the ffmpeg/flite fallback.
- The Piper voice can be overridden with `ttsModel` (a `rhasspy/piper-voices` repo-relative path, e.g. `en/en_US/amy/medium/en_US-amy-medium`) or the `PIPER_VOICE_MODEL` env var in the CLI.
- Where Piper isn't available, `WindowsSapiSynthesizer` uses `System.Speech.Synthesis` (built into Windows) and plays directly to the default audio device; `FfmpegFliteSynthesizer` uses ffmpeg's `flite` audio filter to render a WAV and `ffplay` to play it.

**Audio capture** — `FFmpegMicrophoneRecorder`.

- Captures the default Windows microphone through ffmpeg DirectShow (`-f dshow`), piping raw 16-bit PCM (16 kHz, mono) from ffmpeg's stdout.
- An energy-based `SilenceDetector` (VAD) stops automatically ~450 ms after speech ends (down from 800 ms in V1), with a configurable 15 s max-duration cap.
- The captured device is passed to ffmpeg as a single argv element (no shell, no quoting issues), regardless of whether the id is a friendly name or a `@device_cm_{...}` path.

## Installation requirements (Windows)

Voice V2 is local-first and adds no native Node bindings.

### Required

- **Node.js >= 20** (existing requirement)
- **ffmpeg + ffplay** (microphone capture, flite fallback, and Piper/WAV playback)
  - Scoop: `scoop install ffmpeg`
  - Or from <https://www.gyan.dev/ffmpeg/builds/> and add `ffmpeg`/`ffplay` to `PATH`.
- **Python 3.10+**
- **faster-whisper + ctranslate2** (local STT)
  ```bash
  pip install faster-whisper ctranspose2
  ```
  These install cleanly on Windows; prebuilt `ctranslate2` wheels are used (no C++ compiler needed).

### Recommended (natural neural voice)

- **piper-tts** (local neural TTS)
  ```bash
  pip install piper-tts
  ```
  If Piper is not installed, V2 falls back to Windows SAPI (built-in) and then to the ffmpeg/flite fallback. Piper has no GPU dependency.

### Models (downloaded automatically on first use)

- **Whisper `tiny`** (STT): downloaded once to the HuggingFace cache (`%USERPROFILE%\.cache\huggingface`) and reused offline.
- **Piper voice `en_US-amy-medium`** (TTS): downloaded once to `%TEMP%\arcon-voice-piper-models` (override with `PIPER_VOICE_MODEL`) and reused offline. Any voice from the `rhasspy/piper-voices` repo works (e.g. `en/en_US/amy/medium/en_US-amy-medium`).

To suppress the harmless symlink warning on first download, enable Developer Mode or run:

```bash
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
```

### Verify your environment

```powershell
ffmpeg -version        # capture + flite fallback + piper playback
ffplay -version        # audio playback
python -c "import faster_whisper; print(faster_whisper.__version__)"
python -c "import piper; print('piper ok')"   # optional, for natural voice
```

> Windows SAPI needs no install. If SAPI is unavailable, the flite fallback needs `ffmpeg` **and** `ffplay`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Arcon LLM endpoint (unchanged from text mode). |
| `OLLAMA_MODEL` | `qwen3:1.7b` | Arcon LLM model (unchanged from text mode). |
| `PIPER_VOICE_MODEL` | `en_US-amy-medium` | Piper voice (repo-relative path under `rhasspy/piper-voices`, without the `.onnx` extension). Used by the CLI. |
| `VOICE_DEBUG` | (unset) | Set to any truthy value to print per-stage latency metrics to stderr each turn. |

These are the same `OLLAMA_*` variables the text chat uses — voice reuses the exact same `ChatService` path. `PIPER_VOICE_MODEL` and `VOICE_DEBUG` are voice-mode only.

### Measuring latency

`VoiceService` emits a `VoiceTurnMetrics` snapshot at the end of every turn via the `onTurnMetrics` event callback (see `VoiceTurnMetrics` in `interfaces.ts`):

| Metric | Meaning |
|---|---|
| `recordMs` | microphone capture duration (VAD-gated). |
| `sttMs` | Whisper transcription duration (model stays warm across turns). |
| `chatMs` | `ChatService.chat()` duration — includes memory extraction + the LLM call. |
| `ttsMs` | TTS synthesis + audio playback duration. |
| `timeToFirstAudioMs` | **headline metric** — from "user stops speaking" (end of recording) to "Arcon starts speaking" (playback begins). |
| `totalTurnMs` | full turn wall-clock. |

Run the CLI with metrics:

```bash
set VOICE_DEBUG=1
npm run dev:voice -w @arcon/chat
```

## How to start voice mode

Voice mode extends the existing chat CLI in `apps/chat`:

```bash
npm run dev:voice -w @arcon/chat
```

Then at the prompt:

```
Arcon Voice Mode
Speech recognition + TTS warmed up. Press ENTER to speak, or type 'exit' to quit.
Using default Piper neural voice (set PIPER_VOICE_MODEL to override).
Set VOICE_DEBUG=1 to see per-stage latency metrics.
You (ENTER to speak):
```

On startup the STT model and the TTS voice are **pre-warmed** (the first-turn model-load cold-start is paid at startup, not during a turn). Press `ENTER`, speak into the microphone, and Arcon will transcribe your speech, pass it through the existing `ChatService`, and speak the reply back through your speakers. Type `exit` to quit.

The text path is unchanged:

```bash
npm run dev -w @arcon/chat
```

## Programmatic use

```ts
import { createLocalVoiceService } from "@arcon/voice";

const voice = await createLocalVoiceService(chat, {
	logger,
	environment: { tts: "auto", ttsModel: "en/en_US/amy/medium/en_US-amy-medium" },
	events: {
		onTurnMetrics: (m) => {
			console.error(`[voice] toFirstAudio=${m.timeToFirstAudioMs}ms chat=${m.chatMs}ms stt=${m.sttMs}ms`);
		},
	},
});
await voice.start(); // warms the STT model AND the TTS voice (Piper)
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

A turn is also instrumented via `VoiceTurnMetrics` (record/stt/chat/tts durations plus the headline `timeToFirstAudioMs`); a unit test asserts these are emitted on both success and failure.

## Known limitations (Voice V2)

- Speech recognition runs per-turn on a CPU via `faster-whisper` (`tiny`); longer utterances add latency.
- Recording uses a simple energy threshold rather than advanced VAD; very quiet speakers or noisy rooms may need `recordOptions.energyThreshold` tuning.
- The flite fallback voice is lower quality than Piper/SAPI.
- Only the default microphone input is used; device selection can be supplied via `recordOptions.deviceId`.
- No wake word — a turn is started on demand from the CLI.
- The LLM reply is still buffered by `ChatService` (`stream: false`), so the dominant remaining latency after V2 is the `ChatService`/`Ollama` round-trip, which lives in the Arcon core and is intentionally left untouched here. Streaming the LLM response into the TTS is the recommended next step.
