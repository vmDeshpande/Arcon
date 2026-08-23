export interface QuestionUnderstanding {
  intent: IntentCategory;
  subject: QuestionSubject;
  topic: string | null;
  requiresMemory: boolean;
  requiresEmotion: boolean;
  requiresInterests: boolean;
  requiresIdentity: boolean;
  requiresProjects: boolean;
  requiresConversation: boolean;
  requiresArconState: boolean;
  isQuestion: boolean;
  isAmbiguous: boolean;
  confidence: number;
}

export type IntentCategory =
  | "IDENTITY"
  | "EMOTION"
  | "INTEREST"
  | "USER_INTEREST"
  | "PROJECT"
  | "MEMORY"
  | "CONVERSATION"
  | "GENERAL"
  | "CLARIFICATION";

export type QuestionSubject = "user" | "arcon" | "project" | "general" | null;
