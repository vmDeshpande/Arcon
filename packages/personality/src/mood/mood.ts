export interface MoodState {
  curiosity: number;
  frustration: number;
  askCount: number;
  pendingQuestion: boolean;
  trust: number;
  excitement: number;

  updatedAt: string;
}

export function createDefaultMood(): MoodState {
  return {
    curiosity: 0.5,
    frustration: 0,
    askCount: 0,
    pendingQuestion: false,
    trust: 0.5,
    excitement: 0.5,
    updatedAt: new Date().toISOString(),
  };
}
