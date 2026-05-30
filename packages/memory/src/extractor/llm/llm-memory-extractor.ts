import type { AiClient } from "@arcon/shared";
import { parseExtraction } from "./json-parser.js";
import { buildExtractionPrompt } from "./extraction-prompt.js";
import type { LlmMemoryCandidate } from "./extraction-result.js";
import { LlmExtractorClient } from "./llm-extractor-client.js";

export class LlmMemoryExtractor {
  constructor(private readonly client: LlmExtractorClient) {}

  async extract(message: string): Promise<LlmMemoryCandidate[]> {
    const prompt = buildExtractionPrompt(message);

    const response = await this.client.extract(prompt);

    return parseExtraction(response);
  }
}
