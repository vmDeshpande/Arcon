export interface ConversationEntity {
  name: string;

  type:
    | "PERSON"
    | "PET"
    | "PROJECT"
    | "PLACE"
    | "UNKNOWN";

  lastMentionedAt: string;
}