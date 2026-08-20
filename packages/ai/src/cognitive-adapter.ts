import { EmotionManager, type Emotions } from "@arcon/personality";
import { MoodEngine } from "@arcon/personality";
import { InterestEngine } from "@arcon/personality";
import { ExperienceManager } from "@arcon/personality";
import { MemoryRetriever } from "@arcon/memory";
import { EntityRepository } from "@arcon/memory";
import { ConversationEntityTracker } from "@arcon/memory";
import { IntentType } from "./context/intent-classifier.js";
import { PluginRegistry, ReasoningEngine, Thought, ResponseStrategy, DecisionType, ConfidenceLevel, ReplyStyle } from "@arcon/cognition";

export interface CognitiveInput {
  message: string;
  intent: IntentType;
  emotions: Emotions;
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
}

export interface CognitiveResult {
  thought: Thought;
  strategy: ResponseStrategy;
  strategyReason: string;
  tone: string;
}

export class CognitiveAdapter {
  constructor(
    private readonly emotionEngine: EmotionManager,
    private readonly moodEngine: MoodEngine,
    private readonly interestEngine: InterestEngine,
    private readonly experiences: ExperienceManager,
    private readonly memoryRetriever: MemoryRetriever,
    private readonly entityRepository: EntityRepository,
    private readonly conversationTracker: ConversationEntityTracker,
  ) {}

  async process(input: CognitiveInput): Promise<CognitiveResult> {
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

    let result: Thought;

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

    return {
      thought: result,
      strategy: result.responseStrategy ?? ResponseStrategy.Acknowledge,
      strategyReason: result.strategyReason ?? "Default response",
      tone: result.metadata?.tone ?? "neutral",
    };
  }
}
