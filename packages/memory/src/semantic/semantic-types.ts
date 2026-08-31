export interface SemanticMemory {
  type: string;
  content: string;
  confidenceScore: number;
  importanceScore: number;
  domain?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}