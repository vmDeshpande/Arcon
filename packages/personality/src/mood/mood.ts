export enum MoodCategory {
  NEUTRAL = "NEUTRAL",
  CURIOUS = "CURIOUS",
  FOCUSED = "FOCUSED",
  HAPPY = "HAPPY",
  CALM = "CALM",
  EXCITED = "EXCITED",
  CONCERNED = "CONCERNED",
  FRUSTRATED = "FRUSTRATED",
  SAD = "SAD",
  PLAYFUL = "PLAYFUL",
  SERIOUS = "SERIOUS",
}

export interface MoodState {
  category: MoodCategory;
  intensity: number;
  curiosity: number;
  frustration: number;
  askCount: number;
  pendingQuestion: boolean;
  trust: number;
  excitement: number;
  cause?: string;
  updatedAt: string;
}

export function createDefaultMood(): MoodState {
  return {
    category: MoodCategory.NEUTRAL,
    intensity: 0.5,
    curiosity: 0.5,
    frustration: 0,
    askCount: 0,
    pendingQuestion: false,
    trust: 0.5,
    excitement: 0.5,
    updatedAt: new Date().toISOString(),
  };
}
