import { PluginRegistry } from "../pipeline/plugin-registry";
import { ReasoningPipeline } from "../pipeline/reasoning-pipeline";
import { ThoughtBuilder } from "../thought/thought-builder";
import { Thought } from "../thought/thought";
import { IntentPlugin } from "../plugins/intent/intent-plugin";

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
