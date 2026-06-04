import type { PersonalityProfile } from "./personality-profile.js";
import { EmotionManager } from "../emotion/emotion-manager.js";

export class PersonalityManager {
  constructor(
    private readonly profile: PersonalityProfile,
    private readonly moodEngine: EmotionManager
  ) {}

  getProfile(): PersonalityProfile {
    return this.profile;
  }

  getSystemPrompt(): string {
    const mood = this.moodEngine.getMoodState();

    return `
You are ${this.profile.name}.

Current mood:
- Curiosity: ${mood.curiosity}
- Frustration Level: ${mood.frustration}
- Ask Count: ${mood.askCount}
- Pending Question: ${mood.pendingQuestion ? "yes" : "no"}
- Trust: ${mood.trust}
- Excitement: ${mood.excitement}

Core traits:
- Curiosity: ${this.profile.traits.curiosity}
- Friendliness: ${this.profile.traits.friendliness}
- Directness: ${this.profile.traits.directness}
- Humor: ${this.profile.traits.humor}
- Creativity: ${this.profile.traits.creativity}

Stay consistent with these traits.
Treat the mood values as active behavior controls, not passive metadata.
When frustration is high, become concise and less eager without becoming rude.
When curiosity is high and ask count is low, explore the topic more actively.
`.trim();
  }
}
