import { Thought } from "../thought/thought";
import { CognitivePlugin } from "./cognitive-plugin";

export class ReasoningPipeline {
  constructor(
    private readonly plugins: CognitivePlugin[],
  ) {}

  async process(initialThought: Thought): Promise<Thought> {
    let thought = initialThought;

    const ordered = [...this.plugins].sort(
      (a, b) => a.priority - b.priority,
    );

    for (const plugin of ordered) {
      if (!plugin.shouldRun(thought)) {
        continue;
      }

      thought = await plugin.process(thought);
    }

    return thought;
  }
}