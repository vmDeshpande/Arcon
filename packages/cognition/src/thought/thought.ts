import { Decision } from "../models/decision.js";
import { ReplyStrategy } from "../models/strategy.js";
import { ResponseStrategy } from "../types/enums.js";
import { ThoughtContext } from "../models/context.js";
import { IntentResult } from "../plugins/intent/intent-result.js";

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
   * Reply style guidance.
   */
  strategy: ReplyStrategy;

  /**
   * High-level response strategy selected by cognition.
   */
  responseStrategy?: ResponseStrategy;

  /**
   * Human-readable reason for the selected strategy.
   */
  strategyReason?: string;

  /**
   * Debug metadata.
   */
  metadata: ThoughtMetadata;
}

export interface ThoughtMetadata {
  durationMs?: number;
  pipelineVersion: number;
  tone?: string;
  relevantConversationCount?: number;
  conversationHistoryLength?: number;
}
