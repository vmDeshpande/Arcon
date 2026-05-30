export interface SemanticMemory {
  type: string;
  content: string;
  confidenceScore: number;
  importanceScore: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}