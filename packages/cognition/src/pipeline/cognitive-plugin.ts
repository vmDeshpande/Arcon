import { Thought } from "../thought/thought";

export interface CognitivePlugin {
  /**
   * Plugin identifier.
   */
  readonly id: string;

  /**
   * Lower numbers execute first.
   */
  readonly priority: number;

  /**
   * Whether the plugin should participate.
   */
  shouldRun(thought: Thought): boolean;

  /**
   * Process a thought.
   */
  process(thought: Thought): Promise<Thought>;
}