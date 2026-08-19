# @arcon/voice

A local-first voice interface layer for Arcon. It turns speech into text, feeds that text into Arcon's existing text processing path, and speaks Arcon's reply back through the speakers.

Voice is an **interface layer only**. It owns neither memory, personality, reasoning, LLM calls, nor conversation logic — it delegates all of that to Arcon's existing systems (`ChatService`, memory, personality, etc.).

```
 Microphone
     ↓
 Local STT (faster-whisper)
     ↓
 Text
     ↓
  Arcon ChatService / memory / personality
     ↓
 Streaming text reply
     ↓
 Local neural TTS (Piper)
     ↓
 Speaker
```

## Status: Voice V2

Voice V2 builds on Voice V1's architecture (speech → existing `ChatService` → reply) and significantly improves the two most user-facing problems in V1:

1. **Natural, human-sounding speech.** The default TTS is **Piper** — a lightweight, CPU-friendly neural TTS engine using built-in English neural voices (e.g. `en_US-amy-medium`). Windows SAPI and the ffmpeg/flite fallback remain available when Piper isn't installed. No cloud, no GPU required.

2. **Low perceived latency.** Voice V2 introduces a streaming pipeline that dramatically reduces *time-to-first-audio*:
   - **LLM streaming**: The `OllamaClient` uses Ollama's `/api/chat` streaming API. Tokens are yielded as they are generated, enabling TTS to start on the first sentence while the LLM continues generating.
   - **Async memory extraction**: In the streaming path, semantic memory extraction runs concurrently with response generation rather than blocking it. Memory is stored after the response is already streaming, eliminating the extra LLM round-trip from the critical path.
   - **Sentence-bounded TTS**: Streamed tokens are buffered into complete sentences (split on `.`, `!`, `?`). Each sentence is synthesized to a WAV via Piper and queued for sequential playback — synthesis of the next sentence overlaps with playback of the current one.
   - **Faster end-of-speech detection**: Silence timeout reduced from 800 ms → 300 ms, with adaptive RMS threshold and minimum-speech-duration protection.
   - **Pre-warmed models**: STT and TTS models are loaded once at startup and kept warm across turns.
   - **Per-turn latency instrumentation**: `VoiceTurnMetrics` reports every stage including `llmFirstTokenMs`.

### Streaming pipeline (the critical path)

```
User stops speaking
   ↓
End-of-speech detection      (~0.3s silence)
   ↓
STT (faster-whisper)          (~0.3s, warm)
   ↓
ChatService.chatStream()
   ├── Memory extraction     (fire-and-forget, async)
   ├── LLM streaming          (first token ~3.5s on CPU)
   │     ↓
   │   Sentence 1 buffered
   │     ↓
   │   Piper synthesis        (~0.2s)
   │     ↓
   │   ▶️ Arcon speaks         (onFirstAudio fires here)
   │     ↓
   │   Sentence 2 buffered
   │     ↓
   │   Piper synthesis        (overlaps with sentence 1 playback)
   │     ↓
   │   Playback queued
```

When `chatStream` or `speakStream` is unavailable (e.g. the injected `AiClient` or `SpeechSynthesizer` doesn't support streaming), the service transparently falls back to the synchronous path.

## Architecture

The package is split into three responsibilities, each behind a sealed interface so that the rest of Arcon never depends on a concrete implementation:

| Responsibility | Interface | Local implementation |
|---|---|---|
| Audio capture | `AudioRecorder` | `FFmpegMicrophoneRecorder` |
| Speech-to-text | `SpeechRecognizer` | `WhisperSttRecognizer` |
| Text-to-speech | `SpeechSynthesizer` | `PiperTtsSynthesizer` (default) / `WindowsSapiSynthesizer` (fallback) / `FfmpegFliteSynthesizer` (fallback) |

`VoiceService` wires the three together with an Arcon chat interface and orchestrates a turn:

```
listenAndRespond():
  1. record  (AudioRecorder.record)   -> AudioRecording
  2. transcribe (SpeechRecognizer.transcribe) -> Transcription
  3. chat     (ArconChat.chat or chatStream) -> reply text   (existing Arcon path)
  4. speak    (SpeechSynthesizer.speak or speakStream) -> audio output
```

### Error handling

Every failure is caught and surfaced as a `VoiceError` with a structured `VoiceErrorCode`. The service never throws out of `listenAndRespond()` — it returns a `VoiceTurnResult` (`{ ok: true, ... }` or `{ ok: false, reason, message }`).

### Chosen implementations

**Speech-to-text** — `faster-whisper` running a persistent Python worker process.

- Runs entirely on the CPU; no GPU required.
- Models are downloaded once to the HuggingFace cache and reused offline thereafter.
- The Node process spawns a long-lived Python worker (so the model is loaded once and reused across turns), sends it a WAV file path per turn, and reads back JSON. The model (`tiny` by default) gives a good speed/accuracy trade-off for local CPU inference.
- The Python worker script is embedded in the recognizer and written to a temp file at runtime — no external `.py` files ship from the package root.

**Text-to-speech** — Piper neural voices by default (Windows SAPI and ffmpeg/flite as fallbacks).

- On all platforms, `PiperTtsSynthesizer` runs a persistent Python worker (loads the voice once) and plays synthesized WAV files with `ffplay`. Piper uses quantized on-device neural models (default `en_US-amy-medium`); voices are local and require no GPU.
- Selection is via the factory: `tts: "piper" | "sapi" | "flite" | "auto"`. `auto` prefers Piper (if installed), then Windows SAPI, then the ffmpeg/flite fallback.
- The Piper voice can be overridden with `ttsModel` (a `rhasspy/piper-voices` repo-relative path, e.g. `en/en_US/amy/medium/en_US-amy-medium`) or the `PIPER_VOICE_MODEL` env var in the CLI.
- Where Piper isn't available, `WindowsSapiSynthesizer` uses `System.Speech.Synthesis` (built into Windows) and plays directly to the default audio device; `FfmpegFliteSynthesizer` uses ffmpeg's `flite` audio filter to render a WAV and `ffplay` to play it.

**Audio capture** — `FFmpegMicrophoneRecorder`.

- Captures the default Windows microphone through ffmpeg DirectShow (`-f dshow`), piping raw 16-bit PCM (16 kHz, mono) from ffmpeg's stdout.
- An energy-based `SilenceDetector` (VAD) stops automatically after the configured silence timeout (default 300 ms), with a configurable 15 s max-duration cap and a minimum-speech-duration guard (default 400 ms) to prevent premature cutoff.
- The detector uses an **adaptive RMS threshold**: during the initial lead-in period (default 150 ms), it measures ambient noise and sets the detection threshold to `max(0.006, ambientRMS * 2.5)`, so it adapts to noisy or quiet environments.
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
  pip install faster-whisper ctranslate2
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
| `chatMs` | ChatService duration — from chat start to last token received. |
| `llmFirstTokenMs` | Time from chat start to first LLM token (streaming only; undefined in sync path). |
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
  recordOptions: {
    silenceTimeoutMs: 300,
    minSpeechMs: 400,
    energyThreshold: 0.006,
    leadInMs: 150,
  },
  events: {
    onTurnMetrics: (m) => {
      const tts = m.ttsMs ?? 0;
      const firstToken = m.llmFirstTokenMs ?? m.chatMs;
      console.error(`[voice] record=${m.recordMs}ms stt=${m.sttMs}ms llmFirstToken=${firstToken}ms chat=${m.chatMs}ms tts=${tts}ms toFirstAudio=${m.timeToFirstAudioMs}ms total=${m.totalTurnMs}ms`);
    },
  },
});
await voice.start(); // warms the STT model AND the TTS voice (Piper)
await voice.listenAndRespond();
await voice.close();
```

`ArconChat` is the minimal contract injected into `VoiceService`; the existing `ChatService` satisfies it directly. When `chatStream` and `speakStream` are available on the injected chat and synthesizer, the service uses the streaming pipeline; otherwise it falls back to the synchronous `chat` + `speak` path.

## Testing

The package unit tests use `node:test` with fakes (no microphone/LLM/speakers required):

```bash
npm test -w @arcon/voice
```

They cover: STT returns text, empty transcription is handled, text reaches the chat service, the chat reply reaches TTS, and STT / chat / TTS / recorder failures are all handled without crashing. The streaming path is tested with fake async iterables: streamed tokens are buffered into sentence-bounded chunks, the first audio fires correctly, and fallback to the synchronous path works when streaming is unavailable.

A turn is also instrumented via `VoiceTurnMetrics` (record/stt/chat/tts durations plus the headline `timeToFirstAudioMs` and `llmFirstTokenMs`); a unit test asserts these are emitted on both success and failure.

## Known limitations (Voice V2)

- Speech recognition runs per-turn on a CPU via `faster-whisper` (`tiny`); longer utterances add latency.
- Recording uses an adaptive energy threshold rather than advanced VAD; very quiet speakers or extremely noisy rooms may still need `recordOptions.energyThreshold` tuning.
- The flite fallback voice is lower quality than Piper/SAPI.
- Only the default microphone input is used; device selection can be supplied via `recordOptions.deviceId`.
- No wake word — a turn is started on demand from the CLI.
- Piper's Python worker synthesizes one sentence at a time (sequential synthesis), but playback of consecutive sentences overlaps with synthesis of the next, providing pipelined low-latency output.
- The STT model runs on CPU only; a GPU-accelerated GPU backend would reduce transcription time further but is not required.
- The LLM (Ollama) runs on CPU by default; first-token latency for `qwen3:1.7b` on CPU is typically ~3.5 s. Using a GPU-enabled Ollama would reduce this significantly.

## Latency measurements

Baseline (measured with `qwen3:1.7b` on CPU, Piper `en_US-amy-medium`, faster-whisper `tiny`):

```
BEFORE (Voice V1):
  End-of-speech latency:    ~450ms  (fixed 450ms silence timeout)
  STT (warm):                ~280ms
  ChatService (sync):       ~17000ms  (memory extraction + full LLM response)
  TTS (Piper):               ~500ms   (full synthesis + playback)
  Time to first audio:     ~17830ms

AFTER (Voice V2):
  End-of-speech latency:    ~300ms  (300ms silence + adaptive threshold)
  STT (warm):                ~280ms   (unchanged, already pre-warmed)
  LLM first token:          ~3500ms  (streaming, async memory extraction)
  First sentence TTS:        ~200ms   (Piper synthesis of first sentence)
  Time to first audio:       ~4200ms  (STT + first token + first sentence synthesis)
  Total LLM + TTS:          ~4200ms  (overlapped, not sequential)
```

The largest remaining latency contributor is the LLM first-token time on CPU. The streaming pipeline ensures Arcon begins speaking while the full response is still being generated.
