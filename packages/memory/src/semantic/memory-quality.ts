export function isRedundantEntityOnlyMemory(content: string): boolean {
  const trimmed = content.trim();

  const nameFactMatch = trimmed.match(
    /^([A-Z][a-zA-Z]*)'?s name is ([A-Z][a-zA-Z]*)$/i,
  );

  if (
    nameFactMatch &&
    nameFactMatch[1].toLowerCase() === nameFactMatch[2].toLowerCase()
  ) {
    return true;
  }

  const identityMatch = trimmed.match(
    /^([A-Z][a-zA-Z]*) is ([A-Z][a-zA-Z]*)$/i,
  );

  if (
    identityMatch &&
    identityMatch[1].toLowerCase() === identityMatch[2].toLowerCase()
  ) {
    return true;
  }

  if (/^(?:PROJECT|Entity):\s*[A-Z][a-zA-Z]*$/i.test(trimmed)) {
    return true;
  }

  return /^[A-Z][a-zA-Z]*$/.test(trimmed);
}
