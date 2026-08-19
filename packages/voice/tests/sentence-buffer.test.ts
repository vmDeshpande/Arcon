import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SentenceBuffer } from "../src/audio/sentence-buffer.js";

describe("SentenceBuffer", () => {
	it("returns complete sentences as they are accumulated", () => {
		const buf = new SentenceBuffer();

		let result = buf.append("Hello world.");
		assert.deepEqual(result, ["Hello world."]);
		assert.equal(buf.remaining, "");
	});

	it("withholds incomplete sentences until punctuation arrives", () => {
		const buf = new SentenceBuffer();

		let result = buf.append("Hello, I am");
		assert.deepEqual(result, []);
		assert.equal(buf.remaining, "Hello, I am");

		result = buf.append(" Arcon.");
		assert.deepEqual(result, ["Hello, I am Arcon."]);
		assert.equal(buf.remaining, "");
	});

	it("handles multiple sentences in a single chunk", () => {
		const buf = new SentenceBuffer();

		const result = buf.append("First sentence. Second sentence! Third one?");
		assert.deepEqual(result, ["First sentence.", "Second sentence!", "Third one?"]);
		assert.equal(buf.remaining, "");
	});

	it("handles multiple sentences across multiple chunks", () => {
		const buf = new SentenceBuffer();

		let result = buf.append("First. Second.");
		assert.deepEqual(result, ["First.", "Second."]);

		result = buf.append(" Third!");
		assert.deepEqual(result, ["Third!"]);
		assert.equal(buf.remaining, "");

		result = buf.append(" How are you.");
		assert.deepEqual(result, ["How are you."]);
		assert.equal(buf.remaining, "");
	});

	it("flush returns remaining text", () => {
		const buf = new SentenceBuffer();
		buf.append("Partial sentence without ending");

		const remaining = buf.flush();
		assert.equal(remaining, "Partial sentence without ending");
		assert.equal(buf.remaining, "");
	});

	it("flush on empty buffer returns empty string", () => {
		const buf = new SentenceBuffer();
		assert.equal(buf.flush(), "");
	});

	it("handles newlines as sentence boundaries", () => {
		const buf = new SentenceBuffer();

		const result = buf.append("Hello.\n\nNext paragraph.");
		assert.deepEqual(result, ["Hello.", "Next paragraph."]);
		assert.equal(buf.remaining, "");
	});
});
