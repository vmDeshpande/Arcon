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

export interface ContextSnapshot {
  understanding: QuestionUnderstanding;
  task: string;
  intent: string;
  subject: string | null;
  relevantMemories: Memory[];
  relevantEntities: Array<{ name: string; type?: string }>;
  currentEmotionalState: {
    moodLabel: string;
    emotions: {
      happiness: number;
      frustration: number;
      curiosity: number;
      trust: number;
      confidence: number;
    };
  };
  relevantInterests: Array<{ topic: string; weight: number }>;
  activeGoals: Memory[];
  unresolvedConflicts: Memory[];
  confidence: number;
  selectedTopics: string[];
  excludedTopics: string[];
  contextBudget: {
    maxMemories: number;
    maxConversationTurns: number;
    maxPastConversations: number;
    estimatedTokens: number;
  };
}
