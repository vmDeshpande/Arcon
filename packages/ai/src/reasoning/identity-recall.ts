import { MemoryRepository, MemoryType } from "@arcon/memory";
import { ARCON_IDENTITY, EmotionManager, ExperienceManager, ExperienceType } from "@arcon/personality";
import type { IdentityContext } from "./context-types.js";

export class IdentityRecall {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly experiences: ExperienceManager,
    private readonly emotionEngine: EmotionManager,
  ) {}

  handle(message: string): IdentityContext {
    const normalized = message.toLowerCase().trim();

    const isIdentityQuestion =
      normalized === "who are you?" ||
      normalized === "who are you" ||
      normalized.includes("what do you think about yourself") ||
      normalized.includes("tell me about yourself") ||
      normalized.includes("about yourself");

    const isEmotionQuestion =
      normalized.includes("do you have emotions") ||
      normalized.includes("can you feel emotions") ||
      normalized.includes("do you feel emotions");

    const isInterestQuestion =
      normalized.includes("what are your interests") ||
      normalized.includes("do you have interests") ||
      normalized.includes("what interests you") ||
      normalized.includes("do you have preferences");

    const isCreatorQuestion =
      normalized === "who created you?" ||
      normalized === "who made you?";

    const isSelfReflectionQuestion =
      normalized.includes("what do you think about yourself") ||
      normalized.includes("tell me about yourself") ||
      normalized.includes("about yourself");

    const isUserIdentityQuestion =
      normalized === "who am i?" ||
      normalized === "who am i" ||
      normalized.includes("what do you know about me") ||
      normalized.includes("list everything you remember about me");

    const context: IdentityContext = {
      isIdentityQuestion: isIdentityQuestion || isSelfReflectionQuestion,
      isEmotionQuestion,
      isInterestQuestion,
      isSelfReflectionQuestion,
      isCreatorQuestion,
      isUserIdentityQuestion,
      identity: {
        name: ARCON_IDENTITY.name,
        purpose: ARCON_IDENTITY.purpose,
        creator: ARCON_IDENTITY.creator,
      },
    };

    if (isEmotionQuestion || isIdentityQuestion || isSelfReflectionQuestion) {
      const emotions = this.emotionEngine.getCurrentEmotions();
      context.emotions = {
        curiosity: emotions.curiosity,
        trust: emotions.trust,
        happiness: emotions.happiness,
        confidence: emotions.confidence,
        frustration: emotions.frustration,
      };
    }

    if (isInterestQuestion || isIdentityQuestion || isSelfReflectionQuestion) {
      context.interests = this.repository.listArconInterests().slice(0, 5);
    }

    if (isUserIdentityQuestion) {
      const identityQuestionCount = this.experiences.getCount(
        ExperienceType.USER_ASKED_IDENTITY,
      );
      const allRelationships = this.repository.listMemories({ type: MemoryType.RELATIONSHIP });
      const allPreferences = this.repository.listMemories({ type: MemoryType.PREFERENCE });

      const arconName = ARCON_IDENTITY.name.toLowerCase();

      const memories = [...allRelationships, ...allPreferences].filter((m) => {
        const contentLower = m.content.toLowerCase();
        const subjectLower = m.subject ? m.subject.toLowerCase() : "";

        if (contentLower.includes(arconName) || subjectLower === arconName) {
          return false;
        }

        return true;
      });

      context.userMemories = memories.map((m) => ({ content: m.content }));
      context.askCount = identityQuestionCount;
    }

    return context;
  }
}