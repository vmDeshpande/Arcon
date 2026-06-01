import type { EntityType } from "./entity.js";

export interface ExtractedEntityRelationship {
  relation: string;
  name: string;
  entityType: EntityType;
}

const USER_IDENTITY_BLOCKLIST = new Set([
  "building",
  "creating",
  "developing",
  "making",
  "working",
  "coding",
  "designing",
]);

const RELATIONSHIP_PATTERNS = [
  {
    regex: /user'?s (?:father|dad) is ([a-z][a-zA-Z]*)/i,
    relation: "father",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s (?:mother|mom|mum) is ([a-z][a-zA-Z]*)/i,
    relation: "mother",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s sister(?:'s name)? is ([a-z][a-zA-Z]*)/i,
    relation: "sister",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s brother is ([a-z][a-zA-Z]*)/i,
    relation: "brother",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s best friend is ([a-z][a-zA-Z]*)/i,
    relation: "best_friend",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s friend is ([a-z][a-zA-Z]*)/i,
    relation: "friend",
    entityType: "PERSON" as const,
  },
  {
    regex: /user'?s (?:dog|pet dog|puppy)(?:'s name)? is ([a-z][a-zA-Z]*)/i,
    relation: "dog",
    entityType: "PET" as const,
  },
  {
    regex: /user'?s cat(?:'s name)? is ([a-z][a-zA-Z]*)/i,
    relation: "cat",
    entityType: "PET" as const,
  },
  {
    regex: /user'?s self is ([a-z][a-zA-Z]*)/i,
    relation: "self",
    entityType: "USER" as const,
  },
  {
    regex: /user is building ([a-z][a-zA-Z]*)/i,
    relation: "building",
    entityType: "PROJECT" as const,
  },
  {
    regex: /user'?s building is ([a-z][a-zA-Z]*)/i,
    relation: "building",
    entityType: "PROJECT" as const,
  },
];

const RELATIONSHIP_SYNONYMS: Record<string, string> = {
  dad: "father",
  father: "father",
  mom: "mother",
  mum: "mother",
  mother: "mother",
  "pet dog": "dog",
  puppy: "dog",
  dog: "dog",
  cat: "cat",
};

const RELATIONSHIP_ENTITY_TYPES: Record<string, EntityType> = {
  father: "PERSON",
  mother: "PERSON",
  sister: "PERSON",
  brother: "PERSON",
  best_friend: "PERSON",
  friend: "PERSON",
  dog: "PET",
  cat: "PET",
  self: "USER",
  building: "PROJECT",
};

export function normalizeRelationshipRelation(relation: string): string {
  const normalized = relation.trim().toLowerCase().replace(/\s+/g, " ");
  return RELATIONSHIP_SYNONYMS[normalized] ?? normalized.replace(/\s+/g, "_");
}

export function getRelationshipEntityType(relation: string): EntityType {
  return RELATIONSHIP_ENTITY_TYPES[normalizeRelationshipRelation(relation)] ?? "UNKNOWN";
}

export function isBlockedUserIdentityName(name: string): boolean {
  return USER_IDENTITY_BLOCKLIST.has(name.trim().toLowerCase());
}

export function normalizeRelationshipContent(content: string): string {
  const trimmed = content.trim();

  const userRelationshipMatch = trimmed.match(
    /^user'?s\s+(.+?)\s+is\s+([a-z][a-zA-Z]*)$/i,
  );

  if (userRelationshipMatch) {
    const relation = normalizeRelationshipRelation(userRelationshipMatch[1]);
    return `User's ${relation.replace(/_/g, " ")} is ${userRelationshipMatch[2]}`;
  }

  const reverseUserRelationshipMatch = trimmed.match(
    /^([a-z][a-zA-Z]*)\s+is\s+user'?s\s+(.+?)$/i,
  );

  if (reverseUserRelationshipMatch) {
    const relation = normalizeRelationshipRelation(reverseUserRelationshipMatch[2]);
    return `User's ${relation.replace(/_/g, " ")} is ${reverseUserRelationshipMatch[1]}`;
  }

  return trimmed;
}

export class EntityRelationshipExtractor {
  extract(content: string): ExtractedEntityRelationship | null {
    const normalizedContent = normalizeRelationshipContent(content);

    for (const pattern of RELATIONSHIP_PATTERNS) {
      const match = normalizedContent.match(pattern.regex);

      if (!match) {
        continue;
      }

      if (
        pattern.relation === "self" &&
        isBlockedUserIdentityName(match[1])
      ) {
        continue;
      }

      return {
        relation: pattern.relation,
        name: match[1],
        entityType: pattern.entityType,
      };
    }

    return null;
  }
}
