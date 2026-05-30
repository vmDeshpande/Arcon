export interface LlmExtractorClient {
  extract(
    message: string,
  ): Promise<string>;
}