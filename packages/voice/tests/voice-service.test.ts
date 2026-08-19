import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { encodeWav } from "../src/audio/wav.js";
import { VoiceError } from "../src/errors.js";
import { VoiceService } from "../src/voice-service.js";
import type {
	ArconChat,
	AudioDevice,
	AudioRecorder,
	AudioRecording,
	SpeechRecognizer,
	SpeechSynthesizer,
	Transcription,
	SynthChunk,
} from "../src/interfaces.js";

function makeRecording(): AudioRecording {
	const pcm = Buffer.alloc(3200, 16);
	return {
		wav: encodeWav(pcm, 16000, 1),
		sampleRate: 16000,
		channels: 1,
		durationSeconds: 0.2,
	};
}

class FakeRecorder implements AudioRecorder {
	public calls = 0;
	public thrownError?: VoiceError;
	async isAvailable(): Promise<boolean> {
		return true;
	}
	async listInputDevices(): Promise<AudioDevice[]> {
		return [];
	}
	async record(): Promise<AudioRecording> {
		this.calls += 1;
		if (this.thrownError) {
			throw this.thrownError;
		}
		return makeRecording();
	}
	async stop(): Promise<void> {}
}

class FakeRecognizer implements SpeechRecognizer {
	public startCalls = 0;
	public stopCalls = 0;
	public transcript: Transcription = { text: "hello arcon", language: "en", duration: 1 };
	public thrownError?: VoiceError;
	public lastRecording: AudioRecording | null = null;
	async start(): Promise<void> {
		this.startCalls += 1;
	}
	async stop(): Promise<void> {
		this.stopCalls += 1;
	}
	async isAvailable(): Promise<boolean> {
		return true;
	}
	async transcribe(recording: AudioRecording): Promise<Transcription> {
		this.lastRecording = recording;
		if (this.thrownError) {
			throw this.thrownError;
		}
		return this.transcript;
	}
}

class FakeSynthesizer implements SpeechSynthesizer {
	public spoke: string[] = [];
	public thrownError?: VoiceError;
	async isAvailable(): Promise<boolean> {
		return true;
	}
	async speak(text: string): Promise<void> {
		if (this.thrownError) {
			throw this.thrownError;
		}
		this.spoke.push(text);
	}
	async stop(): Promise<void> {}
}

class FakeChat implements ArconChat {
	public received: string[] = [];
	public reply = "Good to hear from you.";
	public thrownError?: Error;
	async chat(message: string): Promise<{ reply: string }> {
		this.received.push(message);
		if (this.thrownError) {
			throw this.thrownError;
		}
		return { reply: this.reply };
	}
	close(): void {}
}

function build() {
	const recorder = new FakeRecorder();
	const recognizer = new FakeRecognizer();
	const synthesizer = new FakeSynthesizer();
	const chat = new FakeChat();
	const events: Record<string, unknown> = {};

	const service = new VoiceService({
		recorder,
		recognizer,
		synthesizer,
		chat,
  events: {
			onListening: () => {},
			onRecordingStarted: () => {},
			onTranscript: () => {},
			onReply: () => {},
			onSynthesizing: () => {},
			onSilence: () => {},
			onError: (error: VoiceError) => {
				events.lastError = error;
			},
			onTurnMetrics: (metrics) => {
				events.metrics = metrics;
			},
		},
	});

	return { service, recorder, recognizer, synthesizer, chat, events };
}

describe("VoiceService", () => {
	it("transcribes speech with the STT recognizer", async () => {
		const { service, recognizer } = build();
		recognizer.transcript = { text: "hello arcon", language: "en", duration: 1 };

		const result = await service.listenAndRespond();

		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.transcript, "hello arcon");
		}
		assert.equal(recognizer.lastRecording !== null, true);
	});

	it("routes the transcribed text to the Arcon chat service", async () => {
		const { service, chat } = build();

		await service.listenAndRespond();

		assert.equal(chat.received.length, 1);
		assert.equal(chat.received[0], "hello arcon");
	});

	it("reaches the synthesizer with the chat reply", async () => {
		const { service, synthesizer, chat } = build();
		chat.reply = "Hey. Good to hear from you.";

		await service.listenAndRespond();

		assert.deepEqual(synthesizer.spoke, ["Hey. Good to hear from you."]);
	});

	it("handles an empty transcription as no speech", async () => {
		const { service, recognizer, synthesizer, chat } = build();
		recognizer.transcript = { text: "   ", language: null, duration: 0 };

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "NO_SPEECH_DETECTED");
		}
		assert.equal(chat.received.length, 0);
		assert.equal(synthesizer.spoke.length, 0);
	});

	it("handles no speech detected by the recorder", async () => {
		const { service, recorder, chat } = build();
		recorder.thrownError = new VoiceError("NO_SPEECH_DETECTED", "silence");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "NO_SPEECH_DETECTED");
		}
		assert.equal(chat.received.length, 0);
	});

	it("handles STT failure without invoking the chat service", async () => {
		const { service, recognizer, chat, synthesizer } = build();
		recognizer.thrownError = new VoiceError("STT_FAILURE", "model crashed");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "STT_FAILURE");
		}
		assert.equal(chat.received.length, 0);
		assert.equal(synthesizer.spoke.length, 0);
	});

	it("handles chat service failure without synthesizing", async () => {
		const { service, chat, synthesizer } = build();
		chat.thrownError = new Error("Ollama is down");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "CHAT_FAILURE");
		}
		assert.equal(synthesizer.spoke.length, 0);
	});

	it("handles TTS failure after a successful chat turn", async () => {
		const { service, synthesizer, chat, events } = build();
		synthesizer.thrownError = new VoiceError("AUDIO_PLAYBACK_FAILURE", "speakers unavailable");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "AUDIO_PLAYBACK_FAILURE");
		}
		// chat succeeded and produced a reply even though TTS failed
		assert.equal(chat.received.length, 1);
		assert.equal(synthesizer.spoke.length, 0);
	});

	it("never throws out of listenAndRespond", async () => {
		const { service, recognizer } = build();
		recognizer.thrownError = new Error("boom");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "STT_FAILURE");
		}
	});

	it("keeps the service usable across multiple turns", async () => {
		const { service, chat, synthesizer, recognizer } = build();
		recognizer.transcript = { text: "turn two", language: "en", duration: 1 };
		chat.reply = "turn two reply";

		await service.listenAndRespond();
		const second = await service.listenAndRespond();

		assert.equal(second.ok, true);
		if (second.ok) {
			assert.equal(second.reply, "turn two reply");
		}
		assert.equal(chat.received.length, 2);
		assert.equal(synthesizer.spoke.length, 2);
	});

	it("reports per-turn latency metrics on success", async () => {
		const { service, events } = build();

		await service.listenAndRespond();

		const m = events.metrics as
			| { recordMs: number; sttMs: number; chatMs: number; ttsMs: number; timeToFirstAudioMs: number; totalTurnMs: number }
			| null;
		assert.ok(m, "expected onTurnMetrics to be called");
		assert.equal(typeof m!.recordMs, "number");
		assert.equal(typeof m!.sttMs, "number");
		assert.equal(typeof m!.chatMs, "number");
		assert.equal(typeof m!.ttsMs, "number");
		assert.equal(typeof m!.timeToFirstAudioMs, "number");
		assert.equal(typeof m!.totalTurnMs, "number");
		assert.equal(m!.totalTurnMs, m!.recordMs + m!.sttMs + m!.chatMs + m!.ttsMs);
	});

	it("still emits metrics on a failed turn", async () => {
		const { service, recognizer, events } = build();
		recognizer.thrownError = new VoiceError("STT_FAILURE", "model crashed");

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		const m = events.metrics as { totalTurnMs: number } | null;
		assert.ok(m, "expected onTurnMetrics even on failure");
		assert.equal(typeof m!.totalTurnMs, "number");
	});

	it("warms up and tears down the recognizer", async () => {
		const { service, recognizer } = build();
		await service.start();
		assert.equal(recognizer.startCalls, 1);
		await service.close();
		assert.equal(recognizer.stopCalls, 1);
	});

	it("uses streaming path when chatStream and speakStream are available", async () => {
		const fakeChat: ArconChat = {
			chat: async () => ({ reply: "fallback" }),
			chatStream: async function* () {
				yield "Hello";
				yield " world.";
			},
			close: () => {},
		};

		const spokeChunks: string[] = [];

		class StreamingSynthesizer implements SpeechSynthesizer {
			async isAvailable() { return true; }
			async speak(text: string) { spokeChunks.push(text); }
			async speakStream(chunks: AsyncIterable<SynthChunk>) {
				for await (const chunk of chunks) {
					if (chunk.type === "token") {
						spokeChunks.push(chunk.text);
					}
				}
			}
			async stop() {}
		}

		const service = new VoiceService({
			recorder: new FakeRecorder(),
			recognizer: new FakeRecognizer(),
			synthesizer: new StreamingSynthesizer(),
			chat: fakeChat,
			events: {},
		});

		const result = await service.listenAndRespond();

		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.reply, "Hello world.");
		}
		assert.ok(spokeChunks.length > 0, "expected at least one chunk to be spoken");
		assert.equal(typeof fakeChat.chat, "function");
	});

	it("passes raw streamed tokens to the synthesizer", async () => {
		const tokens = ["Hello,", " how are", " you today?", " I hope", " you are well."];
		const fakeChat: ArconChat = {
			chat: async () => ({ reply: "fallback" }),
			chatStream: async function* () {
				for (const t of tokens) {
					yield t;
				}
			},
			close: () => {},
		};

		const receivedChunks: string[] = [];

		class CapturingSynthesizer implements SpeechSynthesizer {
			async isAvailable() { return true; }
			async speak(_text: string) {}
			async speakStream(chunks: AsyncIterable<SynthChunk>) {
				for await (const chunk of chunks) {
					if (chunk.type === "token") {
						receivedChunks.push(chunk.text);
					}
				}
			}
			async stop() {}
		}

		const service = new VoiceService({
			recorder: new FakeRecorder(),
			recognizer: new FakeRecognizer(),
			synthesizer: new CapturingSynthesizer(),
			chat: fakeChat,
			events: {},
		});

		await service.listenAndRespond();

		assert.deepEqual(receivedChunks, tokens);
	});

	it("falls back to synchronous path when chatStream is missing", async () => {
		const { service, synthesizer } = build();

		const result = await service.listenAndRespond();

		assert.equal(result.ok, true);
		assert.equal(synthesizer.spoke.length, 1);
	});

	it("falls back to synchronous path when speakStream is missing", async () => {
		class NoStreamSynthesizer implements SpeechSynthesizer {
			spoke: string[] = [];
			async isAvailable() { return true; }
			async speak(text: string) { this.spoke.push(text); }
			async stop() {}
		}

		const synth = new NoStreamSynthesizer();
		const service = new VoiceService({
			recorder: new FakeRecorder(),
			recognizer: new FakeRecognizer(),
			synthesizer: synth,
			chat: new FakeChat(),
			events: {},
		});

		const result = await service.listenAndRespond();

		assert.equal(result.ok, true);
		assert.equal(synth.spoke.length, 1);
	});

	it("handles streaming chat failure gracefully", async () => {
		const failingChatStream = async function* (): AsyncIterable<string> {
			throw new Error("LLM stream failed");
		};

		const fakeChat: ArconChat = {
			chat: async () => ({ reply: "fallback" }),
			chatStream: failingChatStream,
			close: () => {},
		};

		class ErrorAwareSynthesizer implements SpeechSynthesizer {
			async isAvailable() { return true; }
			async speak(_text: string) {}
			async speakStream(chunks: AsyncIterable<SynthChunk>) {
				for await (const chunk of chunks) {
					if (chunk.type === "error") {
						throw new VoiceError("CHAT_FAILURE", chunk.message);
					}
				}
			}
			async stop() {}
		}

		const events: Record<string, unknown> = {};

		const service = new VoiceService({
			recorder: new FakeRecorder(),
			recognizer: new FakeRecognizer(),
			synthesizer: new ErrorAwareSynthesizer(),
			chat: fakeChat,
			events: {
				onError: (error: VoiceError) => {
					events.lastError = error;
				},
			},
		});

		const result = await service.listenAndRespond();

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.reason, "CHAT_FAILURE");
		}
	});
});
