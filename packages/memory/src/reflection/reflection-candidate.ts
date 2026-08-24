import { MemoryType, MemoryScope, MemoryStatus, MemorySourceType } from "../personal-memory.js";

export type ReflectionProposalType = "CREATE" | "UPDATE" | "SUPERSEDE" | "ARCHIVE" | "NO_OP";

export interface ReflectionExperience {
  id: string;
  type: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  context?: string;
}

export interface ReflectionCandidate {
  proposalType: ReflectionProposalType;
  memoryType: MemoryType;
  content: string;
  confidence: number;
  importance: number;
  reason: string;
  evidence: ExperienceEvidence[];
  affectedMemoryId?: string;
  scope: MemoryScope;
}

export interface ExperienceEvidence {
  experienceType: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  context?: string;
}

export interface ReflectionResult {
  candidates: ReflectionCandidate[];
  processed: number;
  proposed: number;
  noOp: number;
  rejected: number;
}
