import { ReplyStyle } from "../types/enums.js";

export interface ReplyStrategy {
  style: ReplyStyle;

  concise: boolean;

  askFollowUp: boolean;

  referenceMemory: boolean;

  explainReasoning: boolean;
}
