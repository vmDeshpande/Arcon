import type { Memory } from "@arcon/memory";
import type { QuestionUnderstanding } from "./question-understanding.js";

export interface ContextSelection {
  understanding: QuestionUnderstanding;
  memories: Memory[];
  includeUserProfile: boolean;
  includeArconIdentity: boolean;
  includeEmotionState: boolean;
  includeInterests: boolean;
  includeProjects: boolean;
  includeRecentConversation: boolean;
  includeRelevantPastConversations: boolean;
  maxConversationTurns: number;
  maxPastConversations: number;
  maxMemories: number;
  selectedTopics: string[];
  excludedTopics: string[];
}
