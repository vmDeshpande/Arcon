import { CognitivePlugin } from "../../pipeline/cognitive-plugin.js";
import { Thought } from "../../thought/thought.js";
import { ResponseStrategy } from "../../types/enums.js";
import { DecisionType, ConfidenceLevel } from "../../types/enums.js";
import { selectStrategy } from "./strategy-selector.js";

export class StrategyPlugin implements CognitivePlugin {
  readonly id = "strategy";
  readonly priority = 100;

  shouldRun(_thought: Thought): boolean {
    return true;
  }

  async process(thought: Thought): Promise<Thought> {
    const selection = selectStrategy(thought);

    return {
      ...thought,
      responseStrategy: selection.strategy,
      strategyReason: selection.reason,
      strategy: {
        style: selection.style,
        concise: selection.concise,
        askFollowUp: selection.askFollowUp,
        referenceMemory: selection.referenceMemory,
        explainReasoning: false,
      },
      decision: {
        type: selection.strategy === ResponseStrategy.StaySilent
          ? DecisionType.Ignore
          : DecisionType.Respond,
        confidence: ConfidenceLevel.High,
        reason: selection.reason,
      },
      metadata: {
        ...thought.metadata,
        tone: selection.tone,
      },
    };
  }
}
