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
  EmotionEngine,
  InterestEngine,
  ExperienceType,
  buildBehaviorPrompt,
} from "@arcon/personality";
import { PromptBuilder } from "./prompt-builder.js";
import { classifyIntent, IntentType } from "./context/intent-classifier.js";
import { IdentityRecall } from "./reasoning/identity-recall.js";
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
  private readonly emotionEngine: EmotionEngine;
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

    this.emotionEngine = new EmotionEngine(this.repository, this.experiences);
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
    this.interestEngine.updateFromText(message);

    const experience = classifyExperience(message);

    if (experience) {
      this.emotionEngine.updateOnEvent(experience);
      this.experiences.record(experience);

      if (experience === ExperienceType.USER_ASKED_IDENTITY) {
        this.moodEngine.increaseFrustration(0.02);
      }
    }

    const intent = classifyIntent(message);

    const activeEntity = this.conversationTracker.getActiveEntity();

    const resolvedMessage = message;

    const recall = new IdentityRecall(this.repository, this.experiences, this.emotionEngine);

    const recallResult = recall.handle(message);

    const relationshipRecall = new RelationshipRecall();

    const relationshipResult = relationshipRecall.handle(message);

    if (relationshipResult.handled && relationshipResult.reply) {
      this.moodEngine.recordAssistantReply(relationshipResult.reply);

      return {
        prompt: "",
        reply: relationshipResult.reply,
      };
    }

    if (recallResult.handled && recallResult.reply) {
      this.moodEngine.recordAssistantReply(recallResult.reply);

      return {
        prompt: "",
        reply: recallResult.reply,
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
    const behaviorPrompt = buildBehaviorPrompt({
      moodLabel,
      emotions,
      mood: moodState,
      interests,
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

    return {
      prompt,
      reply,
    };
  }

  close(): void {
    this.entityRepository.close();
    this.moodRepository.close();
  }
}
