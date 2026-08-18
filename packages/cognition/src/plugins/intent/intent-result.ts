import {
  RequestComplexity,
  UserGoal,
} from "./intent-types";

export interface IntentResult {
  goal: UserGoal;

  complexity: RequestComplexity;

  confidence: number;

  shouldRetrieveMemory: boolean;

  shouldRetrieveEntities: boolean;

  shouldRetrieveExperiences: boolean;

  shouldEvaluateEmotion: boolean;

  requiresClarification: boolean;
}