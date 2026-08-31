import { IntentType } from "./context/intent-classifier.js";
import {
  Thought,
  ResponseStrategy,
  DecisionType,
  ConfidenceLevel,
  ReplyStyle,
} from "@arcon/cognition";
import type { ContextSnapshot } from "./cognitive/context-selection.js";

export interface CognitiveInput {
  message: string;
  intent: IntentType;
  emotions: {
    happiness: number;
    frustration: number;
    curiosity: number;
    trust: number;
    confidence: number;
  };
  moodLabel: string;
  mood: {
    frustration: number;
    askCount: number;
    pendingQuestion: boolean;
    trust: number;
    excitement: number;
  };
  interests: { topic: string; weight: number }[];
  arconInterests: { topic: string; weight: number }[];
  activeEntity: { name?: string; type?: string } | null;
  recentMemories: { id: string; content: string }[];
  recentExperiences: string[];
  conversationHistory?: string[];
  relevantConversations?: Array<{ conversationId: string; messages: { role: string; content: string }[] }>;
  snapshot: ContextSnapshot;
}

export interface CognitiveDecision {
  thought: Thought;
  decision: {
    type: DecisionType;
    confidence: ConfidenceLevel;
    reason: string;
  };
  strategy: ResponseStrategy;
  strategyReason: string;
  tone: string;
  clarificationNeeded: boolean;
  responseMode: "answer" | "clarify" | "acknowledge" | "refuse" | "defer";
  requiredContext: string[];
  unresolvedConflicts: Array<{ id: string; content: string; status: string }>;
  stages: Array<{ stage: string; summary: string }>;
}

export class CognitiveAdapter {
  async process(input: CognitiveInput): Promise<CognitiveDecision> {
    const recentMemories = input.recentMemories.slice(0, 5);
    const memoryIds = recentMemories.map((m) => m.id);
    const entityIds = input.activeEntity?.name ? [input.activeEntity.name] : [];

    const thought: Thought = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      input: input.message,
      context: {
        memory: {
          memoryIds,
          retrieved: recentMemories.length,
        },
        entity: {
          entityIds,
          retrieved: input.activeEntity ? 1 : 0,
        },
        emotion: {
          currentMood: input.moodLabel,
          emotions: {
            happiness: input.emotions.happiness,
            frustration: input.emotions.frustration,
            curiosity: input.emotions.curiosity,
            trust: input.emotions.trust,
            confidence: input.emotions.confidence,
          },
        },
        experience: {
          experienceIds: input.recentExperiences,
          retrieved: input.recentExperiences.length,
        },
      },
      decision: {
        type: DecisionType.Respond,
        confidence: ConfidenceLevel.Medium,
        reason: "Initial thought",
      },
      strategy: {
        style: ReplyStyle.Natural,
        concise: false,
        askFollowUp: false,
        referenceMemory: recentMemories.length > 0,
        explainReasoning: false,
      },
      metadata: {
        pipelineVersion: 1,
        relevantConversationCount: input.relevantConversations?.length ?? 0,
        conversationHistoryLength: input.conversationHistory?.length ?? 0,
      },
    };

    let result = thought;

    try {
      const { ReasoningPipeline, IntentPlugin, StrategyPlugin } = await import("@arcon/cognition");
      const pipeline = new ReasoningPipeline([
        new IntentPlugin(),
        new StrategyPlugin(),
      ]);
      result = await pipeline.process(thought);
    } catch {
      result = thought;
    }

    const intentConfidence = result.intent?.confidence ?? 0.5;
    const retrievalConfidence = input.snapshot.confidence;
    const hasUnresolvedConflicts = input.snapshot.unresolvedConflicts.length > 0;
    const hasRelevantMemories = input.snapshot.relevantMemories.length > 0;
    const isGreeting = result.intent?.goal === "greeting";


    const requiresClarification =
      (result.intent?.requiresClarification ?? false) ||
      (!isGreeting && input.snapshot.understanding.confidence < 0.7 && !hasRelevantMemories) ||
      (!isGreeting && input.snapshot.understanding.isAmbiguous && !hasRelevantMemories) ||
      (hasUnresolvedConflicts && retrievalConfidence < 0.7);

    const decisionType = requiresClarification
      ? DecisionType.Clarify
      : DecisionType.Respond;

    const responseMode = requiresClarification ? "clarify" : "answer";

    const requiredContext: string[] = [];
    if (input.snapshot.understanding.requiresMemory) requiredContext.push("memory");
    if (input.snapshot.understanding.requiresIdentity) requiredContext.push("identity");
    if (input.snapshot.understanding.requiresProjects) requiredContext.push("project");
    if (input.snapshot.understanding.requiresEmotion) requiredContext.push("emotion");
    if (input.snapshot.understanding.requiresInterests) requiredContext.push("interests");

    const unresolvedConflicts = input.snapshot.unresolvedConflicts.map((m) => ({
      id: m.id,
      content: m.content,
      status: m.status,
    }));

    const stages: Array<{ stage: string; summary: string }> = [
      {
        stage: "context_selection",
        summary: `Selected ${input.snapshot.relevantMemories.length} memories for ${input.snapshot.intent} intent`,
      },
      {
        stage: "reasoning",
        summary: requiresClarification
          ? "Insufficient or ambiguous context; clarification required"
          : `Evaluated ${input.snapshot.relevantMemories.length} relevant memories and ${input.snapshot.relevantEntities.length} entities`,
      },
    ];

    return {
      thought: result,
      decision: {
        type: decisionType,
        confidence: result.decision.confidence,
        reason: result.decision.reason,
      },
      strategy: result.responseStrategy ?? ResponseStrategy.Acknowledge,
      strategyReason: result.strategyReason ?? "Default response",
      tone: result.metadata?.tone ?? "neutral",
      clarificationNeeded: requiresClarification,
      responseMode,
      requiredContext,
      unresolvedConflicts,
      stages,
    };
  }
}
