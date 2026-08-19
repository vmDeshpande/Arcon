const SENTENCE_END_REGEX = /([.!?]+)\s*/g;

export class SentenceBuffer {
	private buffer = "";

	append(text: string): string[] {
		this.buffer += text;
		return this.extractComplete();
	}

	private extractComplete(): string[] {
		const sentences: string[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		SENTENCE_END_REGEX.lastIndex = 0;

		while ((match = SENTENCE_END_REGEX.exec(this.buffer)) !== null) {
			const endIdx = match.index + match[0].length;
			const sentence = this.buffer.slice(lastIndex, endIdx).trim();
			if (sentence) {
				sentences.push(sentence);
			}
			lastIndex = endIdx;
		}

		this.buffer = this.buffer.slice(lastIndex).trim();
		return sentences;
	}

	flush(): string {
		const remaining = this.buffer.trim();
		this.buffer = "";
		return remaining;
	}

	get remaining(): string {
		return this.buffer;
	}

	get isEmpty(): boolean {
		return this.buffer.length === 0;
	}
}
