import { MemoryRepository, MemoryType, MemoryStatus, MemoryRetriever, EntityRepository } from "@arcon/memory";
import { EmotionManager, MoodEngine, InterestEngine } from "@arcon/personality";
import { ConversationStore } from "@arcon/memory";
import { classifyIntent, IntentType } from "../context/intent-classifier.js";
import type { QuestionUnderstanding, IntentCategory, QuestionSubject } from "./question-understanding.js";
import type { ContextSelection } from "./context-selection.js";
import type { Memory } from "@arcon/memory";

export type { ContextSelection } from "./context-selection.js";

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
    const memories = memoryRetriever.retrieveRelevantMemories(message, selection.maxMemories);
    selection.memories = memories;
  }

  if (understanding.requiresConversation && !selection.includeRecentConversation) {
    selection.includeRecentConversation = true;
  }

  return selection;
}
