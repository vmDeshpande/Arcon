import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeWav, rmsOfPcm16, durationOfPcm16 } from "../src/audio/wav.js";
import { SilenceDetector } from "../src/audio/silence.js";

describe("wav helpers", () => {
	it("encodes a valid WAV header followed by PCM samples", () => {
		const pcm = Buffer.alloc(32000, 0);
		const wav = encodeWav(pcm, 16000, 1);

		assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
		assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
		assert.equal(wav.subarray(12, 16).toString("ascii"), "fmt ");
		assert.equal(wav.subarray(36, 40).toString("ascii"), "data");
		assert.equal(wav.length, 44 + 32000);

		const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
		assert.equal(view.getUint32(4, true), 36 + 32000);
		assert.equal(view.getUint32(24, true), 16000);
		assert.equal(view.getUint16(20, true), 1);
		assert.equal(view.getUint16(22, true), 1);
		assert.equal(view.getUint32(40, true), 32000);
	});

	it("computes duration from PCM byte length", () => {
		assert.equal(durationOfPcm16(Buffer.alloc(32000), 16000, 1), 1.0);
		assert.equal(durationOfPcm16(Buffer.alloc(64000), 16000, 1), 2.0);
	});

	it("rmsOfPcm16 is zero for silence and positive for signal", () => {
		assert.equal(rmsOfPcm16(Buffer.alloc(1280)), 0);
		assert.ok(rmsOfPcm16(Buffer.alloc(1280, 160)) > 0);
	});
});

describe("SilenceDetector", () => {
	it("detects speech end after silence timeout", () => {
		const detector = new SilenceDetector({
			threshold: 0.01,
			leadInMs: 0,
			silenceTimeoutMs: 100,
			maxDurationMs: 5000,
			frameMs: 50,
			minSpeechMs: 0,
		});

		const loud = 0.5;
		const quiet = 0;

		const afterSpeech = detector.feed(loud);
		assert.equal(afterSpeech.speaking, true);
		assert.equal(afterSpeech.shouldStop, false);

		const silent = detector.feed(quiet);
		assert.equal(silent.shouldStop, false);

		const silent2 = detector.feed(quiet);
		assert.equal(silent2.shouldStop, true);
	});

	it("stops at max duration even with continuous speech", () => {
		const detector = new SilenceDetector({ threshold: 0.01, leadInMs: 0, silenceTimeoutMs: 500, maxDurationMs: 100, frameMs: 50, minSpeechMs: 0 });
		const r = detector.feed(0.5);
		assert.equal(r.shouldStop, false);
		const r2 = detector.feed(0.5);
		assert.equal(r2.shouldStop, true);
	});

	it("reports no speech when energy never crosses the threshold", () => {
		const detector = new SilenceDetector({ threshold: 0.5, leadInMs: 0, silenceTimeoutMs: 100, maxDurationMs: 50, frameMs: 50, minSpeechMs: 0 });
		const r = detector.feed(0.1);
		assert.equal(r.hasSpeech, false);
		assert.equal(r.shouldStop, true);
	});

	it("enforces min speech duration before allowing silence stop", () => {
		const detector = new SilenceDetector({
			threshold: 0.01,
			leadInMs: 0,
			silenceTimeoutMs: 100,
			maxDurationMs: 5000,
			frameMs: 50,
			minSpeechMs: 400,
		});

		const loud = 0.5;
		const quiet = 0;

		const r1 = detector.feed(loud);
		assert.equal(r1.shouldStop, false);

		const r2 = detector.feed(quiet);
		assert.equal(r2.shouldStop, false);

		const r3 = detector.feed(quiet);
		assert.equal(r3.shouldStop, false);

		const r4 = detector.feed(quiet);
		assert.equal(r4.shouldStop, false);

		const r5 = detector.feed(loud);
		assert.equal(r5.shouldStop, false);

		const r6 = detector.feed(quiet);
		assert.equal(r6.shouldStop, false);

		const r7 = detector.feed(quiet);
		assert.equal(r7.shouldStop, false);

		const r8 = detector.feed(quiet);
		assert.equal(r8.shouldStop, true);
	});

	it("adapts threshold based on ambient noise", () => {
		const detector = new SilenceDetector({
			threshold: 0.01,
			leadInMs: 200,
			silenceTimeoutMs: 100,
			maxDurationMs: 5000,
			frameMs: 50,
			minSpeechMs: 0,
		});

		const ambient = 0.05;
		const loud = 0.3;

		for (let i = 0; i < 4; i++) {
			detector.feed(ambient);
		}

		const speechResult = detector.feed(loud);
		assert.equal(speechResult.speaking, true);
		assert.equal(speechResult.hasSpeech, true);
	});
});
