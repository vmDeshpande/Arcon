import { ConfidenceLevel, DecisionType } from "../types/enums.js";

export interface Decision {
  type: DecisionType;

  confidence: ConfidenceLevel;

  reason: string;
}
