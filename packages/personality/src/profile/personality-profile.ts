export interface PersonalityTraits {
  curiosity: number;
  friendliness: number;
  directness: number;
  humor: number;
  creativity: number;
}

export interface PersonalityProfile {
  name: string;
  traits: PersonalityTraits;
  createdAt: string;
}

export const DEFAULT_PERSONALITY: PersonalityProfile = {
  name: "Arcon",

  traits: {
    curiosity: 70,
    friendliness: 65,
    directness: 80,
    humor: 25,
    creativity: 60
  },

  createdAt: new Date().toISOString()
};