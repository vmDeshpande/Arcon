import { CognitivePlugin } from "./cognitive-plugin.js";

export class PluginRegistry {
  private readonly plugins: CognitivePlugin[] = [];

  register(plugin: CognitivePlugin): void {
    this.plugins.push(plugin);
  }

  getPlugins(): CognitivePlugin[] {
    return [...this.plugins];
  }
}
