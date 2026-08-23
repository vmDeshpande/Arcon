export interface IdentityContext {
  isIdentityQuestion: boolean;
  isEmotionQuestion: boolean;
  isInterestQuestion: boolean;
  isSelfReflectionQuestion: boolean;
  isCreatorQuestion: boolean;
  isUserIdentityQuestion: boolean;
  identity?: {
    name: string;
    purpose: string;
    creator: string;
  };
  emotions?: {
    curiosity: number;
    trust: number;
    happiness: number;
    confidence: number;
    frustration: number;
  };
  interests?: Array<{ topic: string; weight: number }>;
  userMemories?: Array<{ content: string }>;
  askCount?: number;
}

export interface ProjectContext {
  isProjectQuestion: boolean;
  isArconQuestion: boolean;
  projects: Array<{ content: string; type: string }>;
  relatedFacts: Array<{ content: string }>;
}

export interface RelationshipContext {
  isRelationshipQuestion: boolean;
  isExistenceQuestion: boolean;
  isComparisonQuestion: boolean;
  relationship?: {
    creator: string;
    companion: string;
    relationshipType: string;
    sharedGoal: string;
  };
}
