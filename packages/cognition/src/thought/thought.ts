import { Decision } from "../models/decision";
import { ReplyStrategy } from "../models/strategy";
import { ThoughtContext } from "../models/context";
import { IntentResult } from "../plugins/intent/intent-result";

/**
 * A Thought represents one complete cognitive cycle.
 *
 * It contains everything Arcon knows, decides,
 * and plans before generating a response.
 */
export interface Thought {
  /**
   * Unique identifier.
   */
  id: string;

  /**
   * Creation timestamp.
   */
  createdAt: Date;

  /**
   * Original user message.
   */
  input: string;

  /**
   * Shared cognitive context.
   */
  context: ThoughtContext;

  /**
   * Decision produced by cognition.
   */
  decision: Decision;

  intent?: IntentResult;

  /**
   * Reply strategy.
   */
  strategy: ReplyStrategy;

  /**
   * Debug metadata.
   */
  metadata: ThoughtMetadata;
}

export interface ThoughtMetadata {
  durationMs?: number;

  pipelineVersion: number;
}