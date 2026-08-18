import { ConfidenceLevel, DecisionType } from "../types/enums";

export interface Decision {
  type: DecisionType;

  confidence: ConfidenceLevel;

  reason: string;
}