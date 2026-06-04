import { MemoryRepository } from "@arcon/memory";

// Configurable stopwords blacklist
export const STOPWORDS = [
  "hello",
  "hi",
  "hey",
  "what",
  "who",
  "where",
  "when",
  "why",
  "how",
  "know",
  "doing",
  "today",
  "right",
  "name",
  "user",
  "arcon",
  "you",
  "your",
  "sister",
  "brother",
  "mother",
  "father",
  "dad",
  "mom",
  "my",
  "your",
  "is",
  "am",
  "are",
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  programming: ["programming", "coding", "code", "software", "developer", "development"],
  "ai systems": ["ai", "artificial intelligence", "llm", "model", "agent", "ai system", "ai systems"],
  "memory systems": ["memory", "memories", "semantic memory", "entity graph", "knowledge graph"],
  "system design": ["system design", "architecture", "pipeline", "database", "repository"],
  learning: ["learn", "learning", "teach", "curious", "curiosity"],
  "problem solving": ["problem solving", "debug", "debugging", "fix", "investigate"],
  music: ["music", "song", "album", "concert", "guitar", "piano", "drums", "playlist"],
  travel: ["travel", "trip", "vacation", "flight", "hotel", "journey", "destination", "explore", "travelling", "traveling"],
  technology: ["technology", "tech", "software", "computer", "ai", "machine learning", "programming", "code", "app"],
  books: ["book", "novel", "reading", "author", "literature", "story"],
  food: ["food", "cooking", "recipe", "restaurant", "meal", "cuisine", "dining", "buttermilk"],
  sports: ["sport", "soccer", "football", "basketball", "tennis", "baseball", "fitness", "gym"],
  movies: ["movie", "film", "cinema", "actor", "director", "series", "tv"],
  health: ["health", "wellness", "exercise", "nutrition", "workout"],
  science: ["science", "physics", "biology", "chemistry", "astronomy", "research"],
  games: ["game", "gaming", "video game", "board game", "playstation", "xbox", "nintendo", "minecraft"],
};

const VERB_PHRASES = [
  "like",
  "love",
  "enjoy",
  "interested in",
  "interested",
  "hobby",
  "hobbies",
  "favorite",
  "favourite",
  "passion",
  "passionate",
  "play",
  "watch",
  "read",
  "learn",
  "build",
  "explore",
];

const BASE_INCREMENT = 0.2;
const ARCON_BASE_INCREMENT = 0.12;
const DECAY_RATE_PER_MILLISECOND = 0.00000015;
const ARCON_DECAY_RATE_PER_MILLISECOND = 0.00000005;

function normalizeCandidate(raw: string): string {
  let candidate = raw.toLowerCase().trim();
  candidate = candidate.replace(/["'()\[\]\{\}]/g, "");
  candidate = candidate.replace(/[^a-z0-9\s-]/g, " ").trim();

  // simple gerund -> base heuristic (e.g., travelling -> travel, reading -> read)
  candidate = candidate
    .split(" ")
    .map((w) => {
      if (w.endsWith("'s")) w = w.slice(0, -2);
      if (["programming", "coding", "debugging", "learning", "designing"].includes(w)) {
        return w;
      }
      if (w.endsWith("ing") && w.length > 4) {
        w = w.slice(0, -3);
        // collapse doubled trailing consonant (travell -> travel)
        w = w.replace(/([a-z])\1$/, "$1");
      }
      return w;
    })
    .join(" ");

  return candidate;
}

function isStopword(word: string): boolean {
  if (!word) return true;
  const low = word.toLowerCase();
  if (STOPWORDS.includes(low)) return true;
  if (low.length <= 2) return true;
  return false;
}

export class InterestEngine {
  constructor(private readonly memoryRepo: MemoryRepository) {
    // cleanup any previously stored stopword interests on startup
    this.cleanupStopwordInterests();
  }

  private cleanupStopwordInterests(): void {
    try {
      const interests = this.memoryRepo.listInterests();
      for (const interest of interests) {
        if (STOPWORDS.includes(interest.topic.toLowerCase())) {
          this.memoryRepo.deleteInterest(interest.topic);
        }
      }
    } catch (e) {
      // ignore errors during cleanup to avoid startup failure
    }
  }

  updateFromText(text: string): void {
    if (!text || !text.trim()) return;

    const normalized = text.toLowerCase();
    const now = Date.now();

    // find verb-driven phrases first
    for (const phrase of VERB_PHRASES) {
      const re = new RegExp(`\\b${phrase}\\b\\s*(.+?)([\\.!,?]|$)`, "i");
      const match = normalized.match(re);
      if (!match) continue;

      let objectPhrase = match[1].trim();
      // split on conjunctions to handle "music and travel"
      const parts = objectPhrase.split(/\band\b|,|\/|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);

      for (const part of parts) {
        const candidateRaw = part.split(/\s+for\s+|\s+to\s+|\s+about\s+/i)[0].trim();
        const candidate = normalizeCandidate(candidateRaw);

        // pick multiword if meaningful, else first token
        const tokens = candidate.split(/\s+/).filter(Boolean).filter((t) => !isStopword(t));
        if (tokens.length === 0) continue;

        const final = tokens.length > 1 ? tokens.join(" ") : tokens[0];

        if (isStopword(final)) continue;

        // don't store 'arcon' or obvious names
        if (final === "arcon") continue;

        // compute confidence
        let confidence = 0.0;
        // strong signal if candidate matches known topic keywords
        for (const keywords of Object.values(TOPIC_KEYWORDS)) {
          if (keywords.includes(final) || keywords.some((k) => final.includes(k))) {
            confidence = Math.max(confidence, 0.95);
            break;
          }
        }

        // otherwise heuristics
        if (confidence === 0) {
          if (final.length >= 3 && tokens.length === 1) confidence = 0.8;
          else if (tokens.length > 1) confidence = 0.75;
        }

        if (confidence < 0.7) continue;

        const existing = this.memoryRepo.getInterest(final);
        const nextWeight = Math.min(1, (existing?.weight ?? 0) + BASE_INCREMENT * confidence);
        this.memoryRepo.saveInterest(final, nextWeight, now);
      }
    }
  }

  updateArconFromText(
    text: string,
    emotions: { curiosity: number; happiness: number; trust: number },
  ): void {
    if (!text || !text.trim()) return;

    const topics = extractTopics(text);
    if (topics.length === 0) return;

    const curiosityMultiplier = 0.5 + emotions.curiosity;
    const positiveMultiplier =
      1 + Math.max(emotions.happiness, 0) * 0.5 + Math.max(emotions.trust, 0) * 0.25;
    const increment = ARCON_BASE_INCREMENT * curiosityMultiplier * positiveMultiplier;
    const now = Date.now();

    for (const topic of topics) {
      const existing = this.memoryRepo.getArconInterest(topic);
      const nextWeight = Math.min(1, (existing?.weight ?? 0) + increment);
      this.memoryRepo.saveArconInterest(topic, nextWeight, now);
    }
  }

  decay(elapsedMillis: number): void {
    if (elapsedMillis <= 0) return;

    const decayFactor = Math.exp(-DECAY_RATE_PER_MILLISECOND * elapsedMillis);
    const interests = this.memoryRepo.listInterests();

    for (const interest of interests) {
      const nextWeight = interest.weight * decayFactor;
      if (nextWeight < 0.01) this.memoryRepo.deleteInterest(interest.topic);
      else this.memoryRepo.saveInterest(interest.topic, nextWeight, Date.now());
    }

    const arconDecayFactor = Math.exp(-ARCON_DECAY_RATE_PER_MILLISECOND * elapsedMillis);
    const arconInterests = this.memoryRepo.listArconInterests();

    for (const interest of arconInterests) {
      const nextWeight = interest.weight * arconDecayFactor;
      if (nextWeight < 0.01) this.memoryRepo.deleteArconInterest(interest.topic);
      else this.memoryRepo.saveArconInterest(interest.topic, nextWeight, Date.now());
    }
  }

  getTopInterests(): { topic: string; weight: number }[] {
    return this.memoryRepo
      .listInterests()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((interest) => ({ topic: interest.topic, weight: interest.weight }));
  }

  getTopArconInterests(): { topic: string; weight: number }[] {
    return this.memoryRepo
      .listArconInterests()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((interest) => ({ topic: interest.topic, weight: interest.weight }));
  }
}

function extractTopics(text: string): string[] {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      topics.add(topic);
    }
  }

  for (const phrase of VERB_PHRASES) {
    const re = new RegExp(`\\b${phrase}\\b\\s*(.+?)([\\.!,?]|$)`, "i");
    const match = normalized.match(re);
    if (!match) continue;

    const parts = match[1]
      .split(/\band\b|,|\/|\s+and\s+/i)
      .map((part) => normalizeCandidate(part))
      .filter(Boolean);

    for (const part of parts) {
      const tokens = part.split(/\s+/).filter(Boolean).filter((token) => !isStopword(token));
      if (tokens.length === 0) continue;

      const topic = tokens.length > 1 ? tokens.join(" ") : tokens[0];
      if (!isStopword(topic)) {
        topics.add(topic);
      }
    }
  }

  return [...topics];
}
