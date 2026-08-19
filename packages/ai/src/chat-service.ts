import {
  MemoryRepository,
  MemoryPipeline,
  MemoryRetriever,
  buildMemoryContext,
  SemanticValidator,
  SemanticNormalizer,
  toMemoryCandidate,
  EntityResolver,
  EntityRepository,
  EntityMemoryLinker,
  EntityFactRepository,
  EntityKnowledgeBuilder,
  ConversationEntityTracker,
} from "@arcon/memory";
import type { MemoryCandidate } from "@arcon/memory";
import type { AiClient, ChatMessage } from "@arcon/shared";
import {
  buildIdentityPrompt,
  buildUserProfile,
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
import { classifyIntent, IntentType } from "./context/intent-classifier.js";
import { IdentityRecall } from "./reasoning/identity-recall.js";
import { ProjectRecall } from "./reasoning/project-recall.js";
import { RelationshipRecall } from "./reasoning/relationship-recall.js";
import { classifyExperience } from "./experience/experience-classifier.js";
import { LlmMemoryExtractor } from "./semantic-memory/index.js";

export interface ChatResult {
  prompt: string;
  reply: string;
}

export interface ChatServiceOptions {
  experienceDatabasePath?: string;
  moodDatabasePath?: string;
  entityDatabasePath?: string;
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
  ) {
    const experienceRepository = new ExperienceRepository(
      options.experienceDatabasePath ?? "./data/experiences.sqlite",
    );

    this.experiences = new ExperienceManager(experienceRepository);

    this.moodRepository = new MoodRepository(
      options.moodDatabasePath ?? "./data/mood.sqlite",
    );

    this.moodEngine = new MoodEngine(this.moodRepository);

    this.emotionEngine = new EmotionManager(this.repository, this.experiences);
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
  }

  async chat(message: string): Promise<ChatResult> {
    const now = Date.now();
    const elapsed = now - this.lastEmotionTimestamp;

    this.emotionEngine.decay(elapsed);
    this.interestEngine.decay(elapsed);

    this.lastEmotionTimestamp = now;

    this.moodEngine.recordUserTurn(message);
    this.emotionEngine.recordUserTurn(message);

    const experience = classifyExperience(message);

    if (experience) {
      this.emotionEngine.updateOnEvent(experience, message);
      this.experiences.record(experience);

      if (experience === ExperienceType.USER_ASKED_IDENTITY) {
        this.moodEngine.increaseFrustration(0.02);
      }
    }

    this.interestEngine.updateFromText(message);
    this.interestEngine.updateArconFromText(
      message,
      this.emotionEngine.getCurrentEmotions(),
    );

    const intent = classifyIntent(message);

    const activeEntity = this.conversationTracker.getActiveEntity();

    const resolvedMessage = message;

    const recall = new IdentityRecall(this.repository, this.experiences, this.emotionEngine);

    const recallResult = recall.handle(message);

    const relationshipRecall = new RelationshipRecall();

    const relationshipResult = relationshipRecall.handle(message);

    const projectRecall = new ProjectRecall(
      this.repository,
      this.experiences,
      this.emotionEngine,
    );

    const projectResult = projectRecall.handle(message);

    if (relationshipResult.handled && relationshipResult.reply) {
      this.moodEngine.recordAssistantReply(relationshipResult.reply);
      this.emotionEngine.recordAssistantReply(relationshipResult.reply);

      return {
        prompt: "",
        reply: relationshipResult.reply,
      };
    }

    if (recallResult.handled && recallResult.reply) {
      this.moodEngine.recordAssistantReply(recallResult.reply);
      this.emotionEngine.recordAssistantReply(recallResult.reply);

      return {
        prompt: "",
        reply: recallResult.reply,
      };
    }

    if (projectResult.handled && projectResult.reply) {
      this.moodEngine.recordAssistantReply(projectResult.reply);
      this.emotionEngine.recordAssistantReply(projectResult.reply);

      return {
        prompt: "",
        reply: projectResult.reply,
      };
    }

    // ==========================================
    // MEMORY FIRST (SEMANTIC FIRST)
    // ==========================================

    const isQuestion = resolvedMessage.trim().endsWith("?");

    if (isQuestion) {
      // console.log("Skipping memory extraction for question");
    }

    const semanticExtractor = new LlmMemoryExtractor(this.aiClient);

    const semanticMemories = isQuestion
      ? []
      : await semanticExtractor.extract(message, activeEntity);

    const validator = new SemanticValidator();

    const normalizer = new SemanticNormalizer();

    const entityResolver = new EntityResolver();

    const normalizedMemories = [];

    for (const memory of semanticMemories) {
      const validation = validator.validate(memory);

      if (!validation.valid) {
        // console.log("Rejected:", validation.reason);
        continue;
      }

      const normalized = normalizer.normalize(memory);

      // console.log("Normalized:", normalized);

      normalizedMemories.push(normalized);
    }

    const resolvedMemories = entityResolver.resolve(normalizedMemories);
    this.conversationTracker.update(resolvedMemories);

    // console.log("Active Entity:", this.conversationTracker.getActiveEntity());

    this.entityLinker.link(resolvedMemories);

    this.knowledgeBuilder.build(resolvedMemories);

    // console.log("Resolved Memories:", resolvedMemories);

    // console.log("Entity Facts:", this.factRepository.listFacts());

    // console.log("Entities:", this.entityRepository.listEntities());

    // console.log("Links:", this.entityRepository.listLinks());

    const semanticCandidates: MemoryCandidate[] = resolvedMemories.map(
      (memory) => toMemoryCandidate(memory),
    );

    if (semanticCandidates.length > 0) {
      // console.log("Using Semantic Extraction");

      await this.pipeline.processCandidates(semanticCandidates);
    } else {
      // console.log("Falling back to Regex Extraction");

      await this.pipeline.processMessage(resolvedMessage);
    }

    // console.log("Semantic Memories:", semanticMemories);

    // console.log("Semantic Count:", semanticMemories.length);

    // ==========================================
    // BUILD CONTEXT AFTER MEMORY STORAGE
    // ==========================================

    const identityPrompt = buildIdentityPrompt();

    const relationshipPrompt = buildRelationshipPrompt();

    const emotions = this.emotionEngine.getCurrentEmotions();
    const moodLabel = this.emotionEngine.deriveMood();
    const moodState = this.moodEngine.getMood();
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

    let memoryContext = "";

    if (intent === IntentType.USER_PROFILE) {
      memoryContext = buildUserProfile(this.repository);
    } else if (intent === IntentType.ARCON_IDENTITY) {
      memoryContext = "";
    } else {
      const retriever = new MemoryRetriever(
        this.repository,
        this.entityRepository,
        this.factRepository,
      );

      const memories = retriever.retrieveRelevantMemories(resolvedMessage);

      const userProfile = buildUserProfile(this.repository);

      const relevantMemories = buildMemoryContext(memories);

      memoryContext = [userProfile, "", relevantMemories]
        .filter(Boolean)
        .join("\n");
    }

    const prompt = new PromptBuilder().build({
      systemPrompt,
      memoryContext,
      conversationHistory: [],
      userMessage: resolvedMessage,
    });

    const messages: ChatMessage[] = [
      {
        conversationId: "cli",
        role: "system",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];

    const reply = await this.aiClient.generateReply(messages);

    this.moodEngine.recordAssistantReply(reply);
    this.emotionEngine.recordAssistantReply(reply);

    return {
      prompt,
      reply,
    };
  }

  async *chatStream(message: string): AsyncIterable<string> {
    const now = Date.now();
    const elapsed = now - this.lastEmotionTimestamp;

    this.emotionEngine.decay(elapsed);
    this.interestEngine.decay(elapsed);

    this.lastEmotionTimestamp = now;

    this.moodEngine.recordUserTurn(message);
    this.emotionEngine.recordUserTurn(message);

    const experience = classifyExperience(message);

    if (experience) {
      this.emotionEngine.updateOnEvent(experience, message);
      this.experiences.record(experience);

      if (experience === ExperienceType.USER_ASKED_IDENTITY) {
        this.moodEngine.increaseFrustration(0.02);
      }
    }

    this.interestEngine.updateFromText(message);
    this.interestEngine.updateArconFromText(
      message,
      this.emotionEngine.getCurrentEmotions(),
    );

    const intent = classifyIntent(message);

    const activeEntity = this.conversationTracker.getActiveEntity();

    const resolvedMessage = message;

    const recall = new IdentityRecall(this.repository, this.experiences, this.emotionEngine);

    const recallResult = recall.handle(message);

    const relationshipRecall = new RelationshipRecall();

    const relationshipResult = relationshipRecall.handle(message);

    const projectRecall = new ProjectRecall(
      this.repository,
      this.experiences,
      this.emotionEngine,
    );

    const projectResult = projectRecall.handle(message);

    if (relationshipResult.handled && relationshipResult.reply) {
      this.moodEngine.recordAssistantReply(relationshipResult.reply);
      this.emotionEngine.recordAssistantReply(relationshipResult.reply);

      yield relationshipResult.reply;
      return;
    }

    if (recallResult.handled && recallResult.reply) {
      this.moodEngine.recordAssistantReply(recallResult.reply);
      this.emotionEngine.recordAssistantReply(recallResult.reply);

      yield recallResult.reply;
      return;
    }

    if (projectResult.handled && projectResult.reply) {
      this.moodEngine.recordAssistantReply(projectResult.reply);
      this.emotionEngine.recordAssistantReply(projectResult.reply);

      yield projectResult.reply;
      return;
    }

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
    const moodLabel = this.emotionEngine.deriveMood();
    const moodState = this.moodEngine.getMood();
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

    let memoryContext = "";

    if (intent === IntentType.USER_PROFILE) {
      memoryContext = buildUserProfile(this.repository);
    } else if (intent === IntentType.ARCON_IDENTITY) {
      memoryContext = "";
    } else {
      const retriever = new MemoryRetriever(
        this.repository,
        this.entityRepository,
        this.factRepository,
      );

      const memories = retriever.retrieveRelevantMemories(resolvedMessage);

      const userProfile = buildUserProfile(this.repository);

      const relevantMemories = buildMemoryContext(memories);

      memoryContext = [userProfile, "", relevantMemories]
        .filter(Boolean)
        .join("\n");
    }

    const prompt = new PromptBuilder().build({
      systemPrompt,
      memoryContext,
      conversationHistory: [],
      userMessage: resolvedMessage,
    });

    const messages: ChatMessage[] = [
      {
        conversationId: "cli",
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

    this.moodEngine.recordAssistantReply(fullReply);
    this.emotionEngine.recordAssistantReply(fullReply);

    // Await the deferred memory extraction + processing now.
    // This does not block the response (it already completed above), but ensures
    // memory state is consistent before the next turn begins.
    memoryPromise.then(async (semanticMemories) => {
      const validator = new SemanticValidator();
      const normalizer = new SemanticNormalizer();
      const entityResolver = new EntityResolver();

      const normalizedMemories: ReturnType<typeof normalizer.normalize>[] = [];

      for (const memory of semanticMemories) {
        const validation = validator.validate(memory);

        if (!validation.valid) {
          continue;
        }

        const normalized = normalizer.normalize(memory);
        normalizedMemories.push(normalized);
      }

      const resolvedMemories = entityResolver.resolve(normalizedMemories);
      this.conversationTracker.update(resolvedMemories);

      this.entityLinker.link(resolvedMemories);
      this.knowledgeBuilder.build(resolvedMemories);

      const semanticCandidates: MemoryCandidate[] = resolvedMemories.map(
        (memory) => toMemoryCandidate(memory),
      );

      if (semanticCandidates.length > 0) {
        await this.pipeline.processCandidates(semanticCandidates);
      } else {
        await this.pipeline.processMessage(resolvedMessage);
      }
    }).catch(() => {
      /* Memory processing failure must not crash the conversation */
    });

    return;
  }

  close(): void {
    this.entityRepository.close();
    this.moodRepository.close();
  }
}
