# Arcon Voice V1 — Implementation & Change Record

> Local-first voice interface layer for Arcon. Voice converts speech → text, routes that text through Arcon's *existing* text-processing path (`ChatService`, memory, personality, emotion), and speaks the reply back through the speakers. Voice owns no memory, personality, reasoning, or LLM calls of its own.

Status: **Voice V1** (first working voice loop). Single push-to-record turn from the CLI.

---

## 1. What Was Done

Added a complete, local-first voice interface:

- New workspace package `packages/voice` (`@arcon/voice`) with sealed interfaces, a turn-orchestrating `VoiceService`, local STT, local TTS, and microphone capture.
- New CLI entry `apps/chat/src/voice.ts` that wires `ChatService` + microphone + STT + TTS into a push-to-talk loop, run via `npm run dev:voice -w @arcon/chat`.
- Wired the new package into the root build/typecheck chains and the chat app's workspace deps.
- Documented the layer in `docs/architecture.md` and `docs/roadmap.md`, plus a full `packages/voice/README.md`.

---

## 2. Architecture (actual, code-level)

```
Microphone (default dshow audio device)
  │  FFmpegMicrophoneRecorder.record()     src/audio/ffmpeg-microphone-recorder.ts
  │  ffmpeg -f dshow -i audio=<device.id>
  │    -f s16le -ac 1 -ar 16000 -   →  raw 16-bit PCM (16 kHz, mono)
  ├─ startup deadline (2s)          ──► reject MIC_UNAVAILABLE
  └─ SilenceDetector (energy VAD)   ──► auto-stop when speech ends / 15s cap
  │  encodeWav()                    ──► AudioRecording { wav: Buffer, sampleRate, channels, durationSeconds }
  ▼
WhisperSttRecognizer.transcribe()  src/stt/whisper-stt-recognizer.ts
  persistent python worker: faster-whisper / tiny (CPU, int8, ctranslate2)
  write temp WAV ► stdin JSON {path} ► stdout JSON {text, language, duration}
  (30s per-turn timeout; 1 auto-restart on worker death)
  │  empty/missing text            ──► NO_SPEECH_DETECTED
  ▼
apps/chat/src/voice.ts  ──►  ArconChat adapter { chat: (m)=>chatService.chat(m).reply }
  │
  ▼
ChatService.chat(message)   packages/ai/src/chat-service.ts   (EXISTING text path)
   ├─ memory       MemoryRepository + MemoryPipeline (extraction, validation, normalization, entities)
   ├─ personality    ExperienceManager / MoodEngine / EmotionManager / InterestEngine
   ├─ semantic memory LlmMemoryExtractor + SemanticValidator/Normalizer + EntityResolver
   ├─ LLM            OllamaClient.generateReply(messages)   (model qwen3:1.7b by default)
  │  chat failure                    ──► CHAT_FAILURE (no TTS)
  ▼
reply text
  │  WindowsSapiSynthesizer.speak()   (Windows SAPI via PowerShell)   OR
  │  FfmpegFliteSynthesizer.speak()   (ffmpeg flite filter → WAV → ffplay)
  ▼
Speaker (default audio output)
```

**Key design decision:** the voice package depends only on `@arcon/shared`. It never imports `@arcon/ai`. Instead it is *given* an `ArconChat` implementation by the app (`apps/chat/src/voice.ts`), which is the real `ChatService`. So voice reuses 100% of the existing text-processing path — no duplicate LLM/prompting.

---

## 3. Files Changed

### Created
New workspace package `@arcon/voice` (whole directory, currently untracked — not yet committed):

| File | Purpose |
|---|---|
| `packages/voice/package.json` | Package manifest; depends on `@arcon/shared` only; scripts build/typecheck/test. |
| `packages/voice/tsconfig.json` | TSC config (src→dist). |
| `packages/voice/README.md` | Full user docs. |
| `packages/voice/src/index.ts` | Public API re-exports. |
| `packages/voice/src/interfaces.ts` | Sealed interfaces: `AudioRecorder`, `SpeechRecognizer`, `SpeechSynthesizer`, `ArconChat`, `VoiceEventCallbacks`, `VoiceServiceOptions`, `VoiceTurnResult`. |
| `packages/voice/src/types.ts` | Data types: `Transcription`, `AudioRecording`, `AudioDevice`, `RecordOptions`. |
| `packages/voice/src/errors.ts` | `VoiceError` + `VoiceErrorCode` (10 codes). |
| `packages/voice/src/voice-service.ts` | `VoiceService` turn orchestrator (`start`/`listenAndRespond`/`close`). |
| `packages/voice/src/factory.ts` | `createLocalVoiceService()` + `VoiceEnvironment`; selects SAPI vs flite. |
| `packages/voice/src/audio/wav.ts` | `encodeWav`, `rmsOfPcm16`, `durationOfPcm16`. |
| `packages/voice/src/audio/silence.ts` | `SilenceDetector` energy-based VAD. |
| `packages/voice/src/audio/ffmpeg-microphone-recorder.ts` | Mic capture (ffmpeg dshow), device enumeration, VAD, timeouts. |
| `packages/voice/src/stt/whisper-stt-recognizer.ts` | Local `faster-whisper` worker (spawn, JSON protocol, retry-on-death). |
| `packages/voice/src/tts/windows-sapi-synthesizer.ts` | Windows SAPI TTS via PowerShell. |
| `packages/voice/src/tts/ffmpeg-flite-synthesizer.ts` | ffmpeg `flite` + `ffplay` fallback. |
| `packages/voice/src/util/exec.ts` | `which` / `spawnExe`. |
| `packages/voice/src/util/fs.ts` | Temp file helpers. |
| `packages/voice/tests/wav.test.ts` | 3 unit tests (WAV header, duration, RMS). |
| `packages/voice/tests/voice-service.test.ts` | 14 unit tests (routing, no-speech, failure isolation, multi-turn, lifecycle). |
| `apps/chat/src/voice.ts` | Voice CLI: builds ChatService + creates/local voice service; push-to-talk loop. |

`dist/` under `packages/voice` is gitignored build output (regenerated by `tsc`).

### Modified
| File | Change |
|---|---|
| `package.json` (root) | Added `-w @arcon/voice` to `build` and `typecheck` scripts. |
| `package-lock.json` | Lockfile entries for the new workspace + deps. |
| `apps/chat/package.json` | Added `dev:voice` script and deps `@arcon/logger`, `@arcon/voice`. |
| `packages/cognition/package.json` | Added `typecheck` script. |
| `docs/architecture.md` | Added "Voice interface layer" section. |
| `docs/roadmap.md` | Added "Voice V1 (interface layer)" milestone. |

### Renamed / Deleted
None.

> Note: `git status` also reports two unrelated stray root entries — `$` (a captured diagnostic probe) and `con` (a Windows device-name artifact Git mis-reports). Neither is part of Voice V1.

---

## 4. Speech-to-Text (how it works)

- **Engine:** `faster-whisper` (`from faster_whisper import WhisperModel`), **local/CPU**, `device="cpu"`, `compute_type="int8"`, default model `tiny` (downloaded once to `%USERPROFILE%\.cache\huggingface`, reused offline).
- **Process model:** a **long-lived Python worker** (so the model loads once and is reused across turns). `WhisperSttRecognizer.launchWorker()` writes an embedded Python script (`STT_WORKER_SCRIPT`, inline in the TS file) to a temp dir and spawns `python <script> <model> <threads>`. On startup it prints `{"event":"ready"}`; Node reads that via `readline` over stdout with a 120 s deadline.
- **Per turn:** `transcribe()` writes the turn's WAV to a temp path, sends `JSON.stringify({path})` on the worker's stdin, and reads one JSON line back (30 s timeout) → `{text, language, duration}`. The temp WAV is deleted in a `finally`.
- **Audio format:** captured by ffmpeg as raw `s16le` 16 kHz mono, re-wrapped to a 44-byte PCM WAV by `encodeWav` before being handed to STT.
- **No speech:** the recorder rejects with `NO_SPEECH_DETECTED`; an empty trimmed transcript also maps to `NO_SPEECH_DETECTED`.
- **Failure handling:** worker death → one automatic restart + retry, then `STT_FAILURE`; malformed JSON / missing text → `STT_FAILURE`. `VoiceService` surfaces `STT_FAILURE` and does **not** invoke `ChatService`.
- Responsible file: `packages/voice/src/stt/whisper-stt-recognizer.ts`.

---

## 5. Text-to-Speech (how it works)

- **Windows default:** `WindowsSapiSynthesizer` — PowerShell `System.Speech.Synthesis.SpeechSynthesizer` (built into Windows, zero install). Writes the reply text to a temp file, runs a small SAPI PowerShell script, and SAPI's `Speak()` blocks until playback finishes (plays to the default audio device).
- **Fallback:** `FfmpegFliteSynthesizer` — `ffmpeg -f lavfi -i flite=text='<text>' -ar 16000 -ac 1 <wav>` then `ffplay -nodisp -autoexit -i <wav>`.
- **Selection:** `createSynthesizer()` in `factory.ts` — `tts: "sapi" | "flite" | "auto"`; auto picks SAPI on Windows. `isAvailable()` probes each backend (SAPI via `powershell`/`which`, flite via `ffmpeg -filters | grep flite` and `ffplay` presence).
- **Generated audio:** kept to a temp file only for the flite path; SAPI plays directly (no persisted audio). Playbacks are synchronous per turn with a 30 s timeout; `stop()` SIGKILLs an active child.
- **Failure:** unavailability → `TTS_FAILURE`; timeout → `AUDIO_PLAYBACK_FAILURE`; non-zero exit → `AUDIO_PLAYBACK_FAILURE` (stderr trimmed to 200 chars).
- Responsible files: `packages/voice/src/tts/windows-sapi-synthesizer.ts`, `packages/voice/src/tts/ffmpeg-flite-synthesizer.ts`, `packages/voice/src/factory.ts`.

---

## 6. VoiceService (how a turn works)

`packages/voice/src/voice-service.ts` — `class VoiceService`.

- **Constructor** takes `VoiceServiceOptions`: `recorder`, `recognizer`, `synthesizer`, `chat: ArconChat`, optional `recordOptions`/`logger`/`events`.
- **`start()`** — warms the STT model (`recognizer.start()`); warmup errors are logged as warnings, not fatal.
- **`listenAndRespond()`** — one full turn:
  1. `onListening` / `onRecordingStarted` → `recorder.record()` → `AudioRecording` (or `NO_SPEECH_DETECTED`/`MIC_UNAVAILABLE`).
  2. `recognizer.transcribe()` → `Transcription` (or `STT_FAILURE`).
  3. Empty trimmed text → `NO_SPEECH_DETECTED`.
  4. `onTranscript` → `chat.chat(text)` → reply (or `CHAT_FAILURE`).
  5. `onReply` → `onSynthesizing` → `synthesizer.speak(reply)` (or `TTS_FAILURE`/`AUDIO_PLAYBACK_FAILURE`).
  6. Resolves `VoiceTurnResult` `{ ok:true, transcript, reply }`.
- **`close()`** — flips a `closed` flag and runs `stop()` on recognizer/recorder/synthesizer (each swallowed).
- **Contract:** `listenAndRespond()` **never throws** — every failure is caught, mapped to a `VoiceError`, and returned as `{ ok:false, reason, message }`; `onError`/`onSilence` callbacks fire accordingly.

---

## 7. Arcon Integration (exactly how voice enters Arcon)

`apps/chat/src/voice.ts` builds the **real** Arcon stack and injects it:

```ts
const chat = {
  chat: async (message: string) => {
    const result = await chatService.chat(message);   // existing path
    return { reply: result.reply };
  },
  close: () => chatService.close(),
};
const voice = await createLocalVoiceService(chat, { logger });
```

So for voice, verbatim answers to the integration checklist:

1. Uses existing `ChatService`? **Yes.**
2. Same AI client? **Yes** — `createOllamaClient` (Ollama), same as text mode.
3. Same memory system? **Yes** — same `MemoryRepository` + `MemoryPipeline`.
4. Same personality system? **Yes** — `ChatService` wires `ExperienceManager`/`MoodEngine`/`EmotionManager`/`InterestEngine`.
5. Same emotion system? **Yes** — same engines inside `ChatService`.
6. Same semantic memory system? **Yes** — `LlmMemoryExtractor` + validators + entity resolver inside `ChatService`.
7. Cognitive Core (`@arcon/cognition`)? **Not wired** — see §8.
8. Entry point into Arcon: `ChatService.chat()` at `packages/ai/src/chat-service.ts:109`, called from `apps/chat/src/voice.ts:34`.
9. Duplicate AI/LLM for voice? **No.** Voice passes the raw transcript to `ChatService.chat()`; there is a single LLM call via `OllamaClient.generateReply`.
10. Separate conversation history? **No.** Voice reuses `ChatService`, which currently sends `conversationHistory: []` and `conversationId: "cli"` — so this matches the existing text-mode behavior (no persistent cross-turn context in `ChatService` today).

Full call chain:
`microphone` → `FFmpegMicrophoneRecorder.record()` → `encodeWav` → `WhisperSttRecognizer.transcribe()` → transcript string → `apps/chat/src/voice.ts` `ArconChat` adapter → `ChatService.chat()` → memory/personality/`OllamaClient.generateReply()` → reply string → `VoiceService` → `WindowsSapiSynthesizer.speak()` → `speaker`.

---

## 8. Cognitive Core

`packages/cognition` (`ReasoningEngine`, plugin `ReasoningPipeline`, `Thought` model) is a **standalone** Cognitive Core. A repo-wide search shows `@arcon/cognition` / `ReasoningPipeline` / `ReasoningEngine` appear **only** inside `packages/cognition` itself — nothing outside consumes it. `ChatService` (`packages/ai`) does **not** import `@arcon/cognition`; it uses inline recalls under `packages/ai/src/reasoning/` (`IdentityRecall`/`ProjectRecall`/`RelationshipRecall`).

- **Integrated into voice?** No.
- **Why not:** Voice was built to route through the proven text path (`ChatService`) first; the Cognitive Core is a separate pipeline with no consumer yet.
- **Future integration point:** connect `packages/cognition`'s `ReasoningPipeline`/`ReasoningEngine` into `ChatService.chat()`; because voice calls `ChatService.chat()` directly, it would automatically pick up the Cognitive Core.

---

## 9. How to Run / Requirements (Windows)

```bash
npm run dev:voice -w @arcon/chat
```
Then press **ENTER** to speak, type **exit** to quit. The reply is printed to the terminal **and** spoken.

- Microphone: auto-detected (default dshow audio device). Push-to-record; VAD auto-stops; 15 s cap.
- Requirements: Node ≥ 20; `ffmpeg` (+ optional `ffplay` for the flite fallback); Python 3.10+; `pip install faster-whisper ctranslate2`; Windows SAPI (built-in); Ollama running with model `qwen3:1.7b` (or set `OLLAMA_MODEL`/`OLLAMA_BASE_URL`).
- The text path is unchanged: `npm run dev -w @arcon/chat`.

---

## 10. Configuration

Voice reads **no environment variables** itself. Configuration is **programmatic** via `VoiceEnvironment` (to `createLocalVoiceService`):

| Option | Default | Purpose |
|---|---|---|
| `pythonPath` | `"python"` | STT worker interpreter |
| `ffmpegPath` | `"ffmpeg"` | Capture + flite fallback |
| `ffplayPath` | `"ffplay"` | Flite playback |
| `powershellPath` | `"powershell.exe"` | SAPI launcher |
| `sttModel` | `"tiny"` | faster-whisper model size |
| `cpuThreads` | `4` | Whisper `cpu_threads` |
| `tts` | `"auto"` (`"sapi"\|"flite"\|"auto"`) | Pick synthesizer |

Record behavior via `Partial<RecordOptions>`: `deviceId`, `maxDurationSeconds` (15), `silenceTimeoutMs` (800), `energyThreshold` (0.006), `leadInMs` (300), `onProgress`.

Env vars consumed only by the CLI (`apps/chat/src/voice.ts`) for the LLM path:

| Variable | Default | Required? |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | No |
| `OLLAMA_MODEL` | `qwen3:1.7b` | No |

---

## 11. Dependencies

No new runtime npm dependencies. `@arcon/voice` depends only on `@arcon/shared` (the `Logger` type); audio/ffmpeg/STT/spawn code uses Node built-ins (`child_process`, `fs`, `os`, `path`).

| Dependency | Purpose | Runtime/Device |
|---|---|---|
| `ffmpeg` | Mic capture (dshow) + flite fallback | System on PATH |
| `ffplay` | Flite playback (optional on Windows) | System on PATH |
| `python` 3.10+ | STT worker host | System executable |
| `faster-whisper` + `ctranslate2` | Local Whisper inference | Python (pip) |
| Whisper `tiny` model | Speech→text | HF cache (offline after first run) |
| Windows SAPI | TTS (Windows) | Built into Windows |
| `Ollama` (`qwen3:1.7b`) | LLM backend via ChatService | Local server |

---

## 12. Error Handling

`VoiceService.listenAndRespond()` never throws — returns `{ ok:false, reason, message }` and keeps the CLI loop alive. `start()` tolerates STT warmup failure. `close()` runs `stop()` on all three components.

| Condition | Result | Code |
|---|---|---|
| Mic unavailable / ffmpeg missing / no devices | loop continues | `MIC_UNAVAILABLE` |
| Mic permission denied | detected from ffmpeg stderr | `MIC_PERMISSION_DENIED` |
| No speech (silence or empty transcript) | no chat/TTS | `NO_SPEECH_DETECTED` |
| STT worker crash | one auto-restart, else fail | `STT_FAILURE` |
| ChatService / Ollama failure | no TTS | `CHAT_FAILURE` |
| TTS failure | — | `TTS_FAILURE` |
| Audio playback failure | — | `AUDIO_PLAYBACK_FAILURE` |

---

## 13. Tests

`npm test -w @arcon/voice` (`tsx --test tests/**/*.test.ts`). **17 tests / 3 suites / 0 failures** (verified). All are **unit tests** with fakes (`FakeRecorder`/`FakeRecognizer`/`FakeSynthesizer`/`FakeChat`); no mic/STT/speakers/LLM.

- `tests/wav.test.ts` — WAV header validity, `durationOfPcm16`, `rmsOfPcm16`.
- `tests/voice-service.test.ts` — STT text reaches service; transcript reaches `ChatService`; reply reaches synthesizer; empty/no-speech handling; STT/chat/TTS failure isolation; multi-turn reuse; `start()`/`close()` lifecycle.

(No integration tests that spawn real ffmpeg/faster-whisper/SAPI.)

---

## 14. Build Verification

Workspace-scoped commands (the **root** `npm run build` / `npm run typecheck` chains reference a nonexistent `@arcon/server`, so they fail regardless of Voice V1 — a pre-existing condition).

| Scope | Command | Result |
|---|---|---|
| `@arcon/voice` | `npm run build -w @arcon/voice` (`tsc -p tsconfig.json`) | PASS |
| `@arcon/voice` | `npm run typecheck -w @arcon/voice` | PASS |
| `@arcon/voice` | `npm test -w @arcon/voice` | PASS (17/17) |
| all packages | `npm run typecheck -w @arcon/{shared,logger,memory,personality,ai,cognition,voice}` | PASS |
| `apps/chat` | `tsc --noEmit -p apps/chat/tsconfig.json` (covers `voice.ts`) | PASS |

No lint script exists in the voice package or root.

---

## 15. Actual End-to-End Verification

A live, non-destructive STT + TTS proof was executed in this verification pass (output written only to the OS temp dir; no repo/source files touched):

- **Microphone capture:** devices enumerated — ffmpeg dshow reports 2 audio inputs (Realtek + Intel mic array). Not exercised against a live speaker in this pass (auto-stops on silence).
- **STT:** PASS. Generated speech with Windows SAPI (`"Hello Arcon, how are you today"`) → transcribed via `WhisperSttRecognizer` + faster-whisper `tiny` → returned `"Hello, Arkin. How are you today?"` (model misread "Arcon" as "Arkin"; pipeline itself works).
- **Arcon processing (ChatService):** NOT run live in this pass (would write the user SQLite DBs); `ChatService` typechecks and the `@arcon/ai` tests pass, and Ollama `qwen3:1.7b` is pulled and reachable (HTTP 200).
- **LLM response:** NOT run live via voice in this pass (same Ollama/ChatService gate as above; dependency is present and reachable).
- **TTS:** PASS. `WindowsSapiSynthesizer.isAvailable()` → `true`; `speak("Arcon is listening")` played to speakers.
- **Audio playback:** PASS (SAPI playback completed).
- **Complete voice conversation:** NOT tested in this pass — it requires a human speaking at the mic and the interactive `apps/chat` loop. The component pieces (mic enumerate, STT, ChatService, Ollama, TTS) are all individually present and verified.

---

## 16. Known Limitations (Voice V1)

- **Latency:** `tiny` Whisper runs per-turn on CPU (model loads once at `start()`; transcription adds ~1–2 s).
- **Blocking:** `record()` consumes the ffmpeg stdout stream synchronously per turn (single in-flight turn; no interleaving).
- **No wake word / no continuous listening:** push-to-talk only (ENTER to speak).
- **VAD is naive:** energy-threshold `SilenceDetector` (not advanced VAD); quiet speakers or noisy rooms may need `energyThreshold` tuning.
- **No interruption/barge-in, no streaming STT/TTS** (whole utterance is captured, then transcribed, then spoken).
- **TTS is Windows-first:** SAPI is Windows-only; the flite fallback is lower quality and needs `ffmpeg` + `ffplay`.
- **No cross-turn conversation history:** inherited from `ChatService` (sends `conversationHistory: []`).
- **Whisper `tiny` accuracy:** e.g., "Arcon" transcribed as "Arkin" in the live proof.
- **Default mic only:** device selection possible only via `recordOptions.deviceId`.

---

## 17. Technical Debt

### High Priority
- Root `package.json` `build`/`typecheck` chains reference a **nonexistent** `@arcon/server` workspace → they fail. Wire or remove the `@arcon/server` reference, and/or route through `@arcon/chat`.
- `ChatService` sends no persistent `conversationHistory`; verify whether long-term conversational context is intended for text mode too.
- The Cognitive Core (`packages/cognition`) is orphaned — nothing consumes it despite being a first-class package.

### Medium Priority
- `packages/voice/README.md` §4 implies STT uses `whisper.cpp` in one place while the implementation uses `faster-whisper` — keep README strictly consistent.
- `FFmpegMicrophoneRecorder.listInputDevices()` uses ffmpeg's parsed friendly name as the device id (the README claims `@device_cm_{...}` paths are preferred); clarify behavior / optionally prefer the `@device_cm_` alternative-name path.
- Naive energy VAD — consider a proper voice-activity model or `webrtcvad`.

### Low Priority
- No integration tests covering real ffmpeg/faster-whisper/SAPI (only fakes).
- No wake word / continuous mode.
- Stray `con`/`$` untracked files in the repo root from ad-hoc diagnostics.
- `packages/cognition/package.json` `typecheck` script was added but the package isn't wired into root typecheck.

---

## 18. Recommended Next Steps

1. **Decide the integration target** — explicitly wire `@arcon/cognition` (or confirm the inline `packages/ai/src/reasoning/*` recalls are the intended path), so Voice/ChatService has a single, documented reasoning surface.
2. **Fix root build/typecheck** — remove or satisfy the `@arcon/server` reference.
3. **Add a recorded-fixture STT integration test** (ship a tiny wav under `tests/fixtures` and assert `WhisperSttRecognizer.transcribe()` returns expected text) — currently only fakes are tested.
4. **Continuous listening + wake word** (explicitly out of V1 scope).
5. **Streaming STT/TTS + interruption/barge-in** (out of V1 scope).
6. **Cross-platform TTS** (flite default on non-Windows; currently SAPI-first).

---

## 19. Final Status

| Component | Status |
|---|---|
| Voice package | COMPLETE |
| Microphone capture | PARTIAL (capture code complete; dshow enumerated; no live-speaker test this pass) |
| STT | COMPLETE (live-transcribed a real speech WAV; `tiny` model cached) |
| TTS | COMPLETE (SAPI live playback verified; flite fallback implemented) |
| Audio playback | COMPLETE (SAPI verified; ffplay path for flite) |
| ChatService integration | COMPLETE (wired via `apps/chat/src/voice.ts`; typechecks) |
| Memory integration | COMPLETE (uses existing `MemoryRepository`+`MemoryPipeline`) |
| Personality integration | COMPLETE (existing `ChatService` managers) |
| Emotion integration | COMPLETE (existing `ChatService` engines) |
| Semantic memory | COMPLETE (existing `ChatService` pipeline) |
| Cognitive Core | NOT IMPLEMENTED (wired in neither ChatService nor voice) |
| CLI | COMPLETE (`npm run dev:voice -w @arcon/chat`) |
| Tests | COMPLETE (17/17 unit tests, faked) |
| Build | COMPLETE (voice `tsc` passes; root chains broken by pre-existing `@arcon/server`) |
| End-to-end voice conversation | NOT TESTED (requires live mic speaker; components verified individually) |
