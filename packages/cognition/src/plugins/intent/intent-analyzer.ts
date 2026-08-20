import { IntentResult } from "./intent-result.js";
import {
  RequestComplexity,
  UserGoal,
} from "./intent-types.js";

export class IntentAnalyzer {
  analyze(message: string): IntentResult {
    const text = message.trim().toLowerCase();

    let goal = UserGoal.Conversation;

    if (text.endsWith("?")) {
      goal = UserGoal.AskQuestion;
    }

    if (
      /(build|create|develop)/.test(text)
    ) {
      goal = UserGoal.Build;
    }

    if (
      /(debug|fix|error|issue)/.test(text)
    ) {
      goal = UserGoal.Debug;
    }

    if (
      /(remember|recall)/.test(text)
    ) {
      goal = UserGoal.Remember;
    }

    if (
      /^(hi|hello|hey)\b/.test(text)
    ) {
      goal = UserGoal.Greeting;
    }

    const words = text.split(/\s+/).length;

    let complexity = RequestComplexity.Simple;

    if (words < 5) {
      complexity = RequestComplexity.Trivial;
    }

    if (words > 20) {
      complexity = RequestComplexity.Moderate;
    }

    if (words > 60) {
      complexity = RequestComplexity.Complex;
    }

    return {
      goal,
      complexity,
      confidence: 0.9,

      shouldRetrieveMemory:
        goal !== UserGoal.Greeting,

      shouldRetrieveEntities:
        /(who|project|arcon|building|my)/.test(text),

      shouldRetrieveExperiences:
        goal === UserGoal.Debug,

      shouldEvaluateEmotion:
        complexity !== RequestComplexity.Trivial,

      requiresClarification: false,
    };
  }
}
