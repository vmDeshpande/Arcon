export type EntityType =
  | "PERSON"
  | "PET"
  | "PROJECT"
  | "PLACE"
  | "ORGANIZATION"
  | "USER"
  | "UNKNOWN";

export interface Entity {
  id: string;

  name: string;

  type: EntityType;

  aliases: string[];

  createdAt: string;

  updatedAt: string;
}

export interface EntityLink {
  id: string;

  sourceEntityId: string;

  relation: string;

  targetEntityId: string;

  createdAt: string;
}
