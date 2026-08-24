import { MemoryRetriever, MemoryScope, MemoryType, MemoryStatus } from "@arcon/memory";
import type { MemoryRepository, ConversationStore, EntityRepository, Memory } from "@arcon/memory";
import type { EmotionManager, MoodEngine, InterestEngine } from "@arcon/personality";
import { classifyIntent, IntentType } from "../context/intent-classifier.js";
import type { QuestionUnderstanding, IntentCategory, QuestionSubject } from "./question-understanding.js";
import type { ContextSelection, ContextSnapshot } from "./context-selection.js";

export type { ContextSelection, ContextSnapshot } from "./context-selection.js";

function classifyIntentCategory(message: string, existingIntent: IntentType): IntentCategory {
  const text = message.toLowerCase();

  if (existingIntent === IntentType.ARCON_IDENTITY) {
    return "IDENTITY";
  }

  if (
    text.includes("mood") ||
    text.includes("feeling") ||
    text.includes("emotion") ||
    text.includes("how are you")
  ) {
    return "EMOTION";
  }

  if (
    text.includes("your interests") ||
    text.includes("what interests you") ||
    text.includes("what are you interested")
  ) {
    return "INTEREST";
  }

  if (
    text.includes("my interests") ||
    text.includes("what do i like") ||
    text.includes("what do i enjoy") ||
    text.includes("my preferences") ||
    text.includes("what do i prefer")
  ) {
    return "USER_INTEREST";
  }

  if (
    text.includes("project") ||
    text.includes("building") ||
    text.includes("working on") ||
    text.includes("game") ||
    text.includes("unity") ||
    text.includes("app") ||
    text.includes("system")
  ) {
    return "PROJECT";
  }

  if (
    text.includes("remember") ||
    text.includes("memory") ||
    text.includes("forget") ||
    text.includes("know about me")
  ) {
    return "MEMORY";
  }

  if (
    text.includes("conversation") ||
    text.includes("talked about") ||
    text.includes("just said") ||
    text.includes("earlier") ||
    text.includes("previous")
  ) {
    return "CONVERSATION";
  }

  if (existingIntent === IntentType.USER_PROFILE) {
    return "MEMORY";
  }

  return "GENERAL";
}

function classifyQuestionSubject(message: string, intent: IntentCategory): QuestionSubject {
  if (intent === "IDENTITY" || intent === "EMOTION" || intent === "INTEREST") {
    return "arcon";
  }

  if (intent === "USER_INTEREST" || intent === "MEMORY") {
    return "user";
  }

  if (intent === "PROJECT") {
    return "project";
  }

  const text = message.toLowerCase();

  if (
    text.includes("you") ||
    text.includes("your") ||
    text.includes("arcon")
  ) {
    return "arcon";
  }

  if (
    text.includes("i ") ||
    text.includes("my ") ||
    text.includes("me ")
  ) {
    return "user";
  }

  return "general";
}

function detectAmbiguity(message: string, intent: IntentCategory): boolean {
  const text = message.toLowerCase();

  if (intent === "GENERAL") {
    const words = text.split(/\s+/);
    if (words.length <= 2) {
      return true;
    }
  }

  if (
    text.includes("that") ||
    text.includes("it") ||
    text.includes("this") ||
    text.includes("those")
  ) {
    return true;
  }

  return false;
}

function extractTopics(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const stopwords = new Set([
    "the", "and", "for", "with", "that", "this", "have", "been",
    "what", "when", "where", "which", "about", "from", "just",
    "like", "really", "very", "more", "some", "into", "than",
  ]);

  return words.filter((w) => !stopwords.has(w)).slice(0, 8);
}

function getIntentTopics(intent: IntentCategory): { selected: string[]; excluded: string[] } {
  switch (intent) {
    case "IDENTITY":
      return {
        selected: ["arcon", "identity", "interests", "emotion"],
        excluded: ["project", "game", "unity"],
      };
    case "EMOTION":
      return {
        selected: ["emotion", "mood", "feeling", "arcon"],
        excluded: ["project", "game"],
      };
    case "INTEREST":
      return {
        selected: ["interest", "curious", "arcon"],
        excluded: ["project"],
      };
    case "USER_INTEREST":
      return {
        selected: ["interest", "preference", "like"],
        excluded: ["arcon"],
      };
    case "PROJECT":
      return {
        selected: ["project", "building", "working", "game", "app", "system", "arcon"],
        excluded: [],
      };
    case "MEMORY":
      return {
        selected: ["memory", "remember", "fact", "preference"],
        excluded: [],
      };
    case "CONVERSATION":
      return {
        selected: ["conversation", "talked", "said", "earlier"],
        excluded: [],
      };
    case "CLARIFICATION":
      return {
        selected: [],
        excluded: [],
      };
    case "GENERAL":
    default:
      return {
        selected: [],
        excluded: [],
      };
  }
}

export function analyzeQuestion(message: string): QuestionUnderstanding {
  const existingIntent = classifyIntent(message);
  const intent = classifyIntentCategory(message, existingIntent);
  const subject = classifyQuestionSubject(message, intent);
  const isQuestion = message.trim().endsWith("?") || intent !== "GENERAL";
  const isAmbiguous = detectAmbiguity(message, intent);

  const understanding: QuestionUnderstanding = {
    intent,
    subject,
    topic: null,
    requiresMemory: false,
    requiresEmotion: false,
    requiresInterests: false,
    requiresIdentity: false,
    requiresProjects: false,
    requiresConversation: false,
    requiresArconState: false,
    isQuestion,
    isAmbiguous,
    confidence: isAmbiguous ? 0.6 : 0.85,
  };

  switch (intent) {
    case "IDENTITY":
      understanding.requiresIdentity = true;
      understanding.requiresArconState = true;
      understanding.requiresInterests = true;
      break;

    case "EMOTION":
      understanding.requiresEmotion = true;
      understanding.requiresArconState = true;
      understanding.requiresConversation = true;
      break;

    case "INTEREST":
      understanding.requiresInterests = true;
      understanding.requiresArconState = true;
      understanding.requiresIdentity = true;
      break;

    case "USER_INTEREST":
      understanding.requiresInterests = true;
      understanding.requiresMemory = true;
      break;

    case "PROJECT":
      understanding.requiresProjects = true;
      understanding.requiresMemory = true;
      understanding.requiresConversation = true;
      break;

    case "MEMORY":
      understanding.requiresMemory = true;
      understanding.requiresConversation = true;
      if (subject === "arcon") {
        understanding.requiresIdentity = true;
        understanding.requiresArconState = true;
      }
      break;

    case "CONVERSATION":
      understanding.requiresConversation = true;
      understanding.requiresMemory = true;
      break;

    case "GENERAL":
      understanding.requiresConversation = true;
      understanding.requiresMemory = true;
      understanding.requiresArconState = true;
      break;

    case "CLARIFICATION":
      understanding.requiresConversation = true;
      understanding.requiresMemory = true;
      break;
  }

  return understanding;
}

export function selectContext(
  understanding: QuestionUnderstanding,
  message: string,
  repository: MemoryRepository,
  memoryRetriever: MemoryRetriever,
  emotionEngine: EmotionManager,
  moodEngine: MoodEngine,
  interestEngine: InterestEngine,
  conversationStore: ConversationStore,
  conversationId: string,
  entityRepository?: EntityRepository,
): ContextSelection {
  const selection: ContextSelection = {
    understanding,
    memories: [],
    includeUserProfile: false,
    includeArconIdentity: false,
    includeEmotionState: false,
    includeInterests: false,
    includeProjects: false,
    includeRecentConversation: false,
    includeRelevantPastConversations: false,
    maxConversationTurns: 6,
    maxPastConversations: 1,
    maxMemories: 5,
    selectedTopics: [],
    excludedTopics: [],
  };

  const intentTopics = getIntentTopics(understanding.intent);
  const messageTopics = extractTopics(message);
  selection.selectedTopics = [...new Set([...intentTopics.selected, ...messageTopics])];
  selection.excludedTopics = intentTopics.excluded;

  switch (understanding.intent) {
    case "IDENTITY":
      selection.includeArconIdentity = true;
      selection.includeEmotionState = true;
      selection.includeInterests = true;
      selection.includeRecentConversation = true;
      selection.maxMemories = 0;
      selection.maxConversationTurns = 4;
      break;

    case "EMOTION":
      selection.includeEmotionState = true;
      selection.includeArconIdentity = true;
      selection.includeRecentConversation = true;
      selection.maxMemories = 2;
      selection.maxConversationTurns = 4;
      break;

    case "INTEREST":
      selection.includeInterests = true;
      selection.includeArconIdentity = true;
      selection.maxMemories = 3;
      selection.maxConversationTurns = 4;
      break;

    case "USER_INTEREST":
      selection.includeInterests = true;
      selection.includeUserProfile = true;
      selection.maxMemories = 5;
      selection.maxConversationTurns = 4;
      break;

    case "PROJECT":
      selection.includeProjects = true;
      selection.includeUserProfile = true;
      selection.maxMemories = 5;
      selection.maxConversationTurns = 6;
      selection.maxPastConversations = 1;
      selection.includeRelevantPastConversations = true;
      break;

    case "MEMORY":
      selection.includeUserProfile = true;
      selection.maxMemories = 8;
      selection.maxConversationTurns = 6;
      selection.maxPastConversations = 1;
      selection.includeRelevantPastConversations = true;
      break;

    case "CONVERSATION":
      selection.includeRecentConversation = true;
      selection.includeRelevantPastConversations = true;
      selection.maxMemories = 3;
      selection.maxConversationTurns = 10;
      selection.maxPastConversations = 2;
      break;

    case "GENERAL":
      selection.includeArconIdentity = true;
      selection.includeRecentConversation = true;
      selection.maxMemories = 4;
      selection.maxConversationTurns = 6;
      selection.maxPastConversations = 0;
      break;

    case "CLARIFICATION":
      selection.includeRecentConversation = true;
      selection.includeUserProfile = true;
      selection.maxMemories = 3;
      selection.maxConversationTurns = 8;
      selection.maxPastConversations = 1;
      break;
  }

  if (understanding.requiresMemory) {
    const memories = memoryRetriever.retrieveWithThreshold(message, {
      limit: selection.maxMemories,
      minScore: 12,
      type: understanding.requiresProjects ? undefined : undefined,
      scope: understanding.subject === "arcon" ? MemoryScope.ARCON : understanding.subject === "project" ? MemoryScope.PROJECT : undefined,
    });
    selection.memories = memories;
  }

  if (understanding.requiresConversation && !selection.includeRecentConversation) {
    selection.includeRecentConversation = true;
  }

  return selection;
}

export function buildContextSnapshot(
  selection: ContextSelection,
  message: string,
  emotionEngine: EmotionManager,
  moodEngine: MoodEngine,
  interestEngine: InterestEngine,
  repository: MemoryRepository,
): ContextSnapshot {
  const emotions = emotionEngine.getCurrentEmotions();
  let moodLabel = "neutral";
  try {
    moodLabel = emotionEngine.deriveMood();
  } catch {
    moodLabel = "neutral";
  }
  const moodState = moodEngine.getMood();
  const interests = interestEngine.getTopInterests();
  const arconInterests = interestEngine.getTopArconInterests();

  const activeGoals = repository
    .listMemories({ type: MemoryType.GOAL, status: MemoryStatus.ACTIVE })
    .slice(0, 5);

  const unresolvedConflicts = repository
    .listMemories({ status: MemoryStatus.PENDING_CONFIRMATION })
    .slice(0, 5);

  const estimatedTokens =
    selection.memories.reduce((sum, m) => sum + m.content.length, 0) / 4 +
    selection.maxConversationTurns * 40;

  return {
    understanding: selection.understanding,
    task: message,
    intent: selection.understanding.intent,
    subject: selection.understanding.subject,
    relevantMemories: selection.memories,
    relevantEntities: [],
    currentEmotionalState: {
      moodLabel,
      emotions: {
        happiness: emotions.happiness,
        frustration: emotions.frustration,
        curiosity: emotions.curiosity,
        trust: emotions.trust,
        confidence: emotions.confidence,
      },
    },
    relevantInterests: [
      ...interests.slice(0, 5).map((i) => ({ topic: i.topic, weight: i.weight })),
      ...arconInterests.slice(0, 5).map((i) => ({ topic: i.topic, weight: i.weight })),
    ],
    activeGoals,
    unresolvedConflicts,
    confidence: selection.understanding.confidence,
    selectedTopics: selection.selectedTopics,
    excludedTopics: selection.excludedTopics,
    contextBudget: {
      maxMemories: selection.maxMemories,
      maxConversationTurns: selection.maxConversationTurns,
      maxPastConversations: selection.maxPastConversations,
      estimatedTokens: Math.round(estimatedTokens),
    },
  };
}
