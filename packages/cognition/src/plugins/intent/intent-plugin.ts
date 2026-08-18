import { CognitivePlugin } from "../../pipeline/cognitive-plugin";
import { Thought } from "../../thought/thought";
import { IntentAnalyzer } from "./intent-analyzer";

export class IntentPlugin implements CognitivePlugin {
  readonly id = "intent";

  readonly priority = 0;

  private readonly analyzer = new IntentAnalyzer();

  shouldRun(): boolean {
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