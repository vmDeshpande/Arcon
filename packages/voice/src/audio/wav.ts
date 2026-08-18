function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

export function encodeWav(pcm16: Buffer, sampleRate: number, channels: number): Buffer {
	const numSamples = pcm16.length / 2;
	const byteRate = sampleRate * channels * 2;
	const blockAlign = channels * 2;
	const bitsPerSample = 16;
	const dataSize = numSamples * blockAlign;

	const wav = Buffer.alloc(44 + dataSize);
	const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitsPerSample, true);
	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	pcm16.copy(wav, 44);

	return wav;
}

export function rmsOfPcm16(pcm16: Buffer): number {
	if (pcm16.length < 2) {
		return 0;
	}

	const count = pcm16.length / 2;
	let sum = 0;

	for (let i = 0; i < count; i++) {
		const sample = pcm16.readInt16LE(i * 2) / 32768;
		sum += sample * sample;
	}

	return Math.sqrt(sum / count);
}

export function durationOfPcm16(pcm16: Buffer, sampleRate: number, channels: number): number {
	if (sampleRate <= 0 || channels <= 0) {
		return 0;
	}

	return pcm16.length / (sampleRate * channels * 2);
}
