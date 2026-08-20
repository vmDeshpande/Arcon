import { PluginRegistry } from "../pipeline/plugin-registry.js";
import { ReasoningPipeline } from "../pipeline/reasoning-pipeline.js";
import { ThoughtBuilder } from "../thought/thought-builder.js";
import { Thought } from "../thought/thought.js";
import { IntentPlugin } from "../plugins/intent/intent-plugin.js";

export class ReasoningEngine {
  private readonly builder = new ThoughtBuilder();

  constructor(private readonly registry: PluginRegistry) {
    this.registry.register(new IntentPlugin());
  }

  async think(message: string): Promise<Thought> {
    const thought = this.builder.build(message);

    const pipeline = new ReasoningPipeline(this.registry.getPlugins());

    return pipeline.process(thought);
  }
}
