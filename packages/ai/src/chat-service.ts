import {
  MemoryRepository,
  MemoryPipeline,
  MemoryRetriever,
  SemanticValidator,
  SemanticNormalizer,
  toMemoryCandidate,
  EntityRepository,
  EntityMemoryLinker,
  EntityFactRepository,
  EntityKnowledgeBuilder,
  ConversationEntityTracker,
  ConversationStore,
} from "@arcon/memory";
import type { MemoryCandidate, Memory, PipelineResult, SemanticMemory } from "@arcon/memory";
import type { AiClient, ChatMessage } from "@arcon/shared";
import {
  buildIdentityPrompt,
  buildRelationshipPrompt,
  ExperienceManager,
  ExperienceRepository,
  MoodEngine,
  MoodRepository,
  EmotionManager,
  InterestEngine,
  ExperienceType,
  buildBehaviorPrompt,
} from "@arcon/personality";
import { PromptBuilder } from "./prompt-builder.js";
import { classifyIntent } from "./context/intent-classifier.js";
import { analyzeQuestion, selectContext, buildContextSnapshot } from "./cognitive/cognitive-processor.js";
import { classifyExperience } from "./experience/experience-classifier.js";
import { LlmMemoryExtractor } from "./semantic-memory/index.js";
import { ConversationContext } from "./conversation-context.js";
import { CognitiveAdapter, CognitiveInput, CognitiveDecision } from "./cognitive-adapter.js";
import { stripThinkTokens } from "./utils/strip-think-tokens.js";

export interface ChatResult {
  prompt: string;
  reply: string;
  pendingConfirmations: Memory[];
}

export interface ChatServiceOptions {
  experienceDatabasePath?: string;
  moodDatabasePath?: string;
  entityDatabasePath?: string;
  conversationDatabasePath?: string;
}

export class ChatService {
  private readonly experiences: ExperienceManager;
  private readonly moodEngine: MoodEngine;
  private readonly emotionEngine: EmotionManager;
  private readonly interestEngine: InterestEngine;
  private readonly entityRepository: EntityRepository;
  private readonly entityLinker: EntityMemoryLinker;
  private readonly factRepository: EntityFactRepository;
  private readonly knowledgeBuilder: EntityKnowledgeBuilder;
  private readonly conversationTracker: ConversationEntityTracker;
  private readonly moodRepository: MoodRepository;
  private readonly conversationContext: ConversationContext;
  private readonly conversationStore: ConversationStore;
  private readonly cognitiveAdapter: CognitiveAdapter;
  private lastEmotionTimestamp: number;

  constructor(
    private readonly repository: MemoryRepository,
    private readonly pipeline: MemoryPipeline,
    private readonly aiClient: AiClient = {
      async generateReply() {
        return "";
      },
    },
    options: ChatServiceOptions = {},
    private readonly conversationId: string = crypto.randomUUID(),
  ) {
    const experienceRepository = new ExperienceRepository(
      options.experienceDatabasePath ?? "./data/experiences.sqlite",
    );

    this.experiences = new ExperienceManager(experienceRepository);

    this.moodRepository = new MoodRepository(
      options.moodDatabasePath ?? "./data/mood.sqlite",
    );

    this.emotionEngine = new EmotionManager(this.repository, this.experiences);
    this.moodEngine = new MoodEngine(this.moodRepository, this.emotionEngine);
    this.emotionEngine.setMoodEngine(this.moodEngine);
    this.interestEngine = new InterestEngine(this.repository);
    this.lastEmotionTimestamp = Date.now();

    this.entityRepository = new EntityRepository(
      options.entityDatabasePath ?? "./apps/chat/data/entities.sqlite",
    );

    this.entityLinker = new EntityMemoryLinker(this.entityRepository);

    this.factRepository = new EntityFactRepository(
      this.entityRepository.getDatabase(),
    );

    this.knowledgeBuilder = new EntityKnowledgeBuilder(
      this.entityRepository,
      this.factRepository,
    );

    this.conversationTracker = new ConversationEntityTracker(
      this.entityRepository,
    );

    this.conversationContext = new ConversationContext();
    this.conversationStore = new ConversationStore(
      options.conversationDatabasePath ?? "./apps/chat/data/conversations.sqlite",
    );
    this.conversationStore.createConversation({ id: this.conversationId });

    this.cognitiveAdapter = new CognitiveAdapter();
  }

  private processAssistantResponse(
    reply: string,
    strategy: string,
    intent: string,
    arconInterests: { topic: string; weight: number }[],
  ): void {
    this.moodEngine.recordAssistantReply(reply);
    this.conversationContext.addAssistantMessage(this.conversationId, reply);
    this.emotionEngine.recordAssistantTurn(reply, {
      strategy,
      intent,
      arconInterests,
    });
    this.interestEngine.updateArconFromText(
      reply,
      this.emotionEngine.getCurrentEmotions(),
    );
    this.conversationStore.storeMessage({
      conversationId: this.conversationId,
      role: "assistant",
      content: reply,
    });
  }

  private async processMemoryExtraction(
    memoryPromise: Promise<MemoryCandidate[]>,
    resolvedMessage: string,
  ): Promise<PipelineResult> {
    const semanticMemories = await memoryPromise;
    const validator = new SemanticValidator();
    const normalizer = new SemanticNormalizer();

    const normalizedMemories: SemanticMemory[] = [];

    for (const memory of semanticMemories) {
      const validation = validator.validate(memory);

      if (!validation.valid) {
        continue;
      }

      const normalized = normalizer.normalize(memory);
      normalizedMemories.push(normalized);
    }

    const resolvedMemories = normalizedMemories;
    this.conversationTracker.update(resolvedMemories);
    this.entityLinker.link(resolvedMemories);
    this.knowledgeBuilder.build(resolvedMemories);

    const semanticCandidates = resolvedMemories.map((memory) =>
      toMemoryCandidate(memory),
    );

    if (semanticCandidates.length > 0) {
      return this.pipeline.processCandidates(semanticCandidates, resolvedMessage);
    }

    return this.pipeline.processMessage(resolvedMessage);
  }

  async chat(message: string): Promise<ChatResult> {
    this.conversationContext.addUserMessage(this.conversationId, message);
    this.conversationStore.storeMessage({
      conversationId: this.conversationId,
      role: "user",
      content: message,
    });

    const now = Date.now();
    const elapsed = now - this.lastEmotionTimestamp;

    this.emotionEngine.decay(elapsed);
    this.interestEngine.decay(elapsed);

    this.lastEmotionTimestamp = now;

    this.moodEngine.recordUserTurn(message);

    const experience = classifyExperience(message);

    if (experience) {
      this.emotionEngine.updateOnEvent(experience, message);
      this.experiences.record(experience);

      if (experience === ExperienceType.USER_ASKED_IDENTITY) {
        this.moodEngine.increaseFrustration(0.02);
      }
    }

    this.interestEngine.updateFromText(message);

    const intent = classifyIntent(message);

    const activeEntity = this.conversationTracker.getActiveEntity();

    const resolvedMessage = message;

    const understanding = analyzeQuestion(message);

    const retriever = new MemoryRetriever(
      this.repository,
      this.entityRepository,
      this.factRepository,
    );

    const context = selectContext(
      understanding,
      resolvedMessage,
      this.repository,
      retriever,
      this.emotionEngine,
      this.moodEngine,
      this.interestEngine,
      this.conversationStore,
      this.conversationId,
      this.entityRepository,
    );

    const snapshot = buildContextSnapshot(
      context,
      resolvedMessage,
      this.emotionEngine,
      this.moodEngine,
      this.interestEngine,
      this.repository,
    );

    // Memory extraction runs concurrently with response generation.
    // The memory context for the prompt comes from the repository (already
    // stored memories), not from the current message's extraction, so it is
    // safe to defer extraction + storage until after the response is sent.
    const isQuestion = resolvedMessage.trim().endsWith("?");

    const semanticExtractor = new LlmMemoryExtractor(this.aiClient);

    const memoryPromise = isQuestion
      ? Promise.resolve([])
      : semanticExtractor.extract(message, activeEntity);

    // Build prompt using existing repository memories (not the current extraction)
    const identityPrompt = buildIdentityPrompt();
    const relationshipPrompt = buildRelationshipPrompt();

    const emotions = this.emotionEngine.getCurrentEmotions();
    const moodState = this.moodEngine.getMood();
    const moodLabel = moodState.category;
    const interests = this.interestEngine.getTopInterests();
    const arconInterests = this.interestEngine.getTopArconInterests();
    const behaviorPrompt = buildBehaviorPrompt({
      moodLabel,
      emotions,
      mood: moodState,
      interests,
      arconInterests,
    });

    const systemPrompt = [
      identityPrompt,
      "",
      relationshipPrompt,
      "",
      behaviorPrompt,
    ].join("\n");

    const conversationHistory = this.conversationContext.toPromptLines(this.conversationId);

    const cognitiveInput: CognitiveInput = {
      message: resolvedMessage,
      intent,
      emotions,
      moodLabel,
      mood: {
        frustration: moodState.frustration,
        askCount: moodState.askCount,
        pendingQuestion: moodState.pendingQuestion,
        trust: moodState.trust,
        excitement: moodState.excitement,
      },
      interests,
      arconInterests,
      activeEntity: activeEntity ? { name: activeEntity.name, type: activeEntity.type } : null,
      recentMemories: context.memories
        .slice(0, 5)
        .map((m) => ({ id: m.id, content: m.content })),
      recentExperiences: this.experiences.list().slice(0, 5).map((e) => e.type),
      conversationHistory,
      relevantConversations: context.includeRelevantPastConversations
        ? this.conversationStore.getRelevantConversationHistory(resolvedMessage, context.maxPastConversations).map((entry) => ({
            conversationId: entry.conversation.id,
            messages: entry.messages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }))
        : [],
      snapshot,
    };

    const cognitiveResult = await this.cognitiveAdapter.process(cognitiveInput);

    if (cognitiveResult.clarificationNeeded) {
      const clarificationPrompt = new PromptBuilder().build({
        systemPrompt: [
          systemPrompt,
          "",
          "RUNTIME CAPABILITIES:",
          "Arcon is running locally with SQLite-backed persistent memory, emotion, interest, and conversation storage.",
          "Arcon does not have web search, file system access, or external tool execution in this runtime.",
        ].join("\n"),
        context,
        snapshot,
        cognitiveDecision: cognitiveResult,
        conversationHistory: conversationHistory.slice(-context.maxConversationTurns),
        userMessage: resolvedMessage,
        strategy: {
          responseStrategy: cognitiveResult.strategy,
          reason: cognitiveResult.strategyReason,
          tone: cognitiveResult.tone,
        },
      });

      const clarificationMessages: ChatMessage[] = [
        {
          conversationId: this.conversationId,
          role: "system",
          content: clarificationPrompt,
          createdAt: new Date().toISOString(),
        },
      ];

      const rawClarification = await this.aiClient.generateReply(clarificationMessages);
      const reply = stripThinkTokens(rawClarification);

      this.processAssistantResponse(
        reply,
        cognitiveResult.strategy,
        intent,
        arconInterests,
      );

      this.processMemoryExtraction(memoryPromise, resolvedMessage).catch(
        () => {
          /* Memory processing failure must not crash the conversation */
        },
      );

      return {
        prompt: clarificationPrompt,
        reply,
        pendingConfirmations: [],
      };
    }

    const runtimeIdentityPrompt = [
      systemPrompt,
      "",
      "RUNTIME CAPABILITIES:",
      "Arcon is running locally with SQLite-backed persistent memory, emotion, interest, and conversation storage.",
      "Arcon does not have web search, file system access, or external tool execution in this runtime.",
    ].join("\n");

    const prompt = new PromptBuilder().build({
      systemPrompt: runtimeIdentityPrompt,
      context,
      snapshot,
      cognitiveDecision: cognitiveResult,
      conversationHistory: conversationHistory.slice(-context.maxConversationTurns),
      userMessage: resolvedMessage,
      strategy: {
        responseStrategy: cognitiveResult.strategy,
        reason: cognitiveResult.strategyReason,
        tone: cognitiveResult.tone,
      },
    });

    const messages: ChatMessage[] = [
      {
        conversationId: this.conversationId,
        role: "system",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];

    const rawReply = await this.aiClient.generateReply(messages);
    const reply = stripThinkTokens(rawReply);

    this.processAssistantResponse(
      reply,
      cognitiveResult.strategy,
      intent,
      arconInterests,
    );

    const pipelineResult = await this.processMemoryExtraction(
      memoryPromise,
      resolvedMessage,
    );

    return {
      prompt,
      reply,
      pendingConfirmations: pipelineResult.pendingConfirmations,
    };
  }

  async *chatStream(message: string): AsyncIterable<string> {
    this.conversationContext.addUserMessage(this.conversationId, message);
    this.conversationStore.storeMessage({
      conversationId: this.conversationId,
      role: "user",
      content: message,
    });

    const now = Date.now();
    const elapsed = now - this.lastEmotionTimestamp;

    this.emotionEngine.decay(elapsed);
    this.interestEngine.decay(elapsed);

    this.lastEmotionTimestamp = now;

    this.moodEngine.recordUserTurn(message);

    const experience = classifyExperience(message);

    if (experience) {
      this.emotionEngine.updateOnEvent(experience, message);
      this.experiences.record(experience);

      if (experience === ExperienceType.USER_ASKED_IDENTITY) {
        this.moodEngine.increaseFrustration(0.02);
      }
    }

    this.interestEngine.updateFromText(message);

    const intent = classifyIntent(message);

    const activeEntity = this.conversationTracker.getActiveEntity();

    const resolvedMessage = message;

    const understanding = analyzeQuestion(message);

    const retriever = new MemoryRetriever(
      this.repository,
      this.entityRepository,
      this.factRepository,
    );

    const context = selectContext(
      understanding,
      resolvedMessage,
      this.repository,
      retriever,
      this.emotionEngine,
      this.moodEngine,
      this.interestEngine,
      this.conversationStore,
      this.conversationId,
      this.entityRepository,
    );

    const snapshot = buildContextSnapshot(
      context,
      resolvedMessage,
      this.emotionEngine,
      this.moodEngine,
      this.interestEngine,
      this.repository,
    );

    // Memory extraction runs concurrently with response generation.
    // The memory context for the prompt comes from the repository (already
    // stored memories), not from the current message's extraction, so it is
    // safe to defer extraction + storage until after the response is sent.
    const isQuestion = resolvedMessage.trim().endsWith("?");

    const semanticExtractor = new LlmMemoryExtractor(this.aiClient);

    const memoryPromise = isQuestion
      ? Promise.resolve([])
      : semanticExtractor.extract(message, activeEntity);

    // Build prompt using existing repository memories (not the current extraction)
    const identityPrompt = buildIdentityPrompt();
    const relationshipPrompt = buildRelationshipPrompt();

    const emotions = this.emotionEngine.getCurrentEmotions();
    const moodState = this.moodEngine.getMood();
    const moodLabel = moodState.category;
    const interests = this.interestEngine.getTopInterests();
    const arconInterests = this.interestEngine.getTopArconInterests();
    const behaviorPrompt = buildBehaviorPrompt({
      moodLabel,
      emotions,
      mood: moodState,
      interests,
      arconInterests,
    });

    const systemPrompt = [
      identityPrompt,
      "",
      relationshipPrompt,
      "",
      behaviorPrompt,
    ].join("\n");

    const conversationHistory = this.conversationContext.toPromptLines(this.conversationId);

    const cognitiveInput: CognitiveInput = {
      message: resolvedMessage,
      intent,
      emotions,
      moodLabel,
      mood: {
        frustration: moodState.frustration,
        askCount: moodState.askCount,
        pendingQuestion: moodState.pendingQuestion,
        trust: moodState.trust,
        excitement: moodState.excitement,
      },
      interests,
      arconInterests,
      activeEntity: activeEntity ? { name: activeEntity.name, type: activeEntity.type } : null,
      recentMemories: context.memories
        .slice(0, 5)
        .map((m) => ({ id: m.id, content: m.content })),
      recentExperiences: this.experiences.list().slice(0, 5).map((e) => e.type),
      conversationHistory,
      relevantConversations: context.includeRelevantPastConversations
        ? this.conversationStore.getRelevantConversationHistory(resolvedMessage, context.maxPastConversations).map((entry) => ({
            conversationId: entry.conversation.id,
            messages: entry.messages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }))
        : [],
      snapshot,
    };

    const cognitiveResult = await this.cognitiveAdapter.process(cognitiveInput);

    if (cognitiveResult.clarificationNeeded) {
      const clarificationPrompt = new PromptBuilder().build({
        systemPrompt: [
          systemPrompt,
          "",
          "RUNTIME CAPABILITIES:",
          "Arcon is running locally with SQLite-backed persistent memory, emotion, interest, and conversation storage.",
          "Arcon does not have web search, file system access, or external tool execution in this runtime.",
        ].join("\n"),
        context,
        snapshot,
        cognitiveDecision: cognitiveResult,
        conversationHistory: conversationHistory.slice(-context.maxConversationTurns),
        userMessage: resolvedMessage,
        strategy: {
          responseStrategy: cognitiveResult.strategy,
          reason: cognitiveResult.strategyReason,
          tone: cognitiveResult.tone,
        },
      });

      const clarificationMessages: ChatMessage[] = [
        {
          conversationId: this.conversationId,
          role: "system",
          content: clarificationPrompt,
          createdAt: new Date().toISOString(),
        },
      ];

      const rawClarification = await this.aiClient.generateReply(clarificationMessages);
      const reply = stripThinkTokens(rawClarification);

      this.processAssistantResponse(
        reply,
        cognitiveResult.strategy,
        intent,
        arconInterests,
      );

      return {
        prompt: clarificationPrompt,
        reply,
      };
    }

    const runtimeIdentityPrompt = [
      systemPrompt,
      "",
      "RUNTIME CAPABILITIES:",
      "Arcon is running locally with SQLite-backed persistent memory, emotion, interest, and conversation storage.",
      "Arcon does not have web search, file system access, or external tool execution in this runtime.",
    ].join("\n");

    const prompt = new PromptBuilder().build({
      systemPrompt: runtimeIdentityPrompt,
      context,
      snapshot,
      cognitiveDecision: cognitiveResult,
      conversationHistory: conversationHistory.slice(-context.maxConversationTurns),
      userMessage: resolvedMessage,
      strategy: {
        responseStrategy: cognitiveResult.strategy,
        reason: cognitiveResult.strategyReason,
        tone: cognitiveResult.tone,
      },
    });

    const messages: ChatMessage[] = [
      {
        conversationId: this.conversationId,
        role: "system",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];

    let fullReply = "";

    if (this.aiClient.generateReplyStream) {
      for await (const chunk of this.aiClient.generateReplyStream(messages)) {
        fullReply += chunk;
        yield chunk;
      }
    } else {
      const reply = await this.aiClient.generateReply(messages);
      fullReply = reply;
      yield reply;
    }

    const cleanedReply = stripThinkTokens(fullReply);

    this.processAssistantResponse(
      cleanedReply,
      cognitiveResult.strategy,
      intent,
      arconInterests,
    );

    // Await the deferred memory extraction + processing now.
    // This does not block the response (it already completed above), but ensures
    // memory state is consistent before the next turn begins.
    memoryPromise.then(async (semanticMemories) => {
      const validator = new SemanticValidator();
      const normalizer = new SemanticNormalizer();

      const normalizedMemories: ReturnType<typeof normalizer.normalize>[] = [];

      for (const memory of semanticMemories) {
        const validation = validator.validate(memory);

        if (!validation.valid) {
          continue;
        }

        const normalized = normalizer.normalize(memory);
        normalizedMemories.push(normalized);
      }

      const resolvedMemories = normalizedMemories;
      this.conversationTracker.update(resolvedMemories);

      this.entityLinker.link(resolvedMemories);
      this.knowledgeBuilder.build(resolvedMemories);

      const semanticCandidates: MemoryCandidate[] = resolvedMemories.map(
        (memory) => toMemoryCandidate(memory),
      );

      if (semanticCandidates.length > 0) {
        await this.pipeline.processCandidates(semanticCandidates, resolvedMessage);
      } else {
        await this.pipeline.processMessage(resolvedMessage);
      }
    }).catch(() => {
      /* Memory processing failure must not crash the conversation */
    });

    return {
      prompt,
      reply: cleanedReply,
    };
  }

  close(): void {
    this.entityRepository.close();
    this.moodRepository.close();
    this.conversationStore.close();
  }
}
