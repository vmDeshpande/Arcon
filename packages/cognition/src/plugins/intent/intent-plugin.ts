import { CognitivePlugin } from "../../pipeline/cognitive-plugin.js";
import { Thought } from "../../thought/thought.js";
import { IntentAnalyzer } from "./intent-analyzer.js";

export class IntentPlugin implements CognitivePlugin {
  readonly id = "intent";

  readonly priority = 0;

  private readonly analyzer = new IntentAnalyzer();

  shouldRun(_thought: Thought): boolean {
    return true;
  }

  async process(thought: Thought): Promise<Thought> {
    return {
      ...thought,

      intent: this.analyzer.analyze(
        thought.input,
      ),
    };
  }
}
