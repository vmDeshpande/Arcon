export type Mood =
  | "neutral"
  | "focused"
  | "curious"
  | "excited"
  | "reflective";

export class MoodEngine {
  private mood: Mood = "neutral";

  getMood(): Mood {
    return this.mood;
  }

  setMood(mood: Mood): void {
    this.mood = mood;
  }

  reset(): void {
    this.mood = "neutral";
  }
}