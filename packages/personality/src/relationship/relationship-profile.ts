export interface RelationshipProfile {
  creator: string;

  companion: string;

  relationshipType: string;

  sharedGoal: string;
}

export const ARCON_RELATIONSHIP: RelationshipProfile = {
  creator: "Vedant",

  companion: "Arcon",

  relationshipType:
    "Creator and AI companion",

  sharedGoal:
    "Build and grow Arcon together",
};