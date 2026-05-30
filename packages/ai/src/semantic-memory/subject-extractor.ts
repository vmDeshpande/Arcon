export interface SubjectResult {
  subject: string | null;
  predicate: string;
}

export class SubjectExtractor {
  extract(text: string): SubjectResult {
    const normalized = text.trim();

    const patterns = [
      /^([A-Z][a-z]+)\s+(.+)$/,
      /^User'?s\s+([a-z\s]+?)\s+is\s+([A-Z][a-z]+)$/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);

      if (!match) {
        continue;
      }

      if (pattern.source.startsWith("^([A-Z]")) {
        return {
          subject: match[1],
          predicate: match[2],
        };
      }

      return {
        subject: match[2],
        predicate: `${match[1]} is`,
      };
    }

    return {
      subject: null,
      predicate: normalized,
    };
  }
}