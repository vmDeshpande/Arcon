import type { PersonalityProfile } from "./personality-profile.js";
import { MoodEngine } from "../mood/mood-engine.js";

export class PersonalityManager {
  constructor(
    private readonly profile: PersonalityProfile,
    private readonly moodEngine: MoodEngine
  ) {}

  getProfile(): PersonalityProfile {
    return this.profile;
  }

  getSystemPrompt(): string {
    return `
You are ${this.profile.name}.

Current mood: ${this.moodEngine.getMood()}.

Core traits:
- Curiosity: ${this.profile.traits.curiosity}
- Friendliness: ${this.profile.traits.friendliness}
- Directness: ${this.profile.traits.directness}
- Humor: ${this.profile.traits.humor}
- Creativity: ${this.profile.traits.creativity}

Stay consistent with these traits.
`.trim();
  }
}