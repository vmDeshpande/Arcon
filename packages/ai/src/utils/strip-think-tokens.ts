export function stripThinkTokens(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return stripped || text.trim();
}
