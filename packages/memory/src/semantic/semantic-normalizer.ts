import type {
  SemanticMemory,
} from "./semantic-types.js";
import {
  isBlockedUserIdentityName,
  normalizeRelationshipContent,
} from "../entity/entity-relationship-extractor.js";

export class SemanticNormalizer {
  normalize(
    memory: SemanticMemory,
  ): SemanticMemory {
    let content =
      memory.content.trim();

    content =
      this.normalizeRelationships(
        content,
      );

    content =
      this.normalizePreferences(
        content,
      );

    content =
      this.normalizeFacts(
        content,
      );

    return {
      ...memory,
      content,
    };
  }

  private normalizeRelationships(
    content: string,
  ): string {
    const projectRelationship = this.normalizeProjectRelationship(content);

    if (projectRelationship) {
      return projectRelationship;
    }

    const identityRelationship = this.normalizeIdentityRelationship(content);

    if (identityRelationship) {
      return identityRelationship;
    }

    return normalizeRelationshipContent(content)
      .replace(
        /^user is (?:building|creating|developing|making|coding|designing|working on) /i,
        "User's building is ",
      )
      .replace(
        /^my name is /i,
        "User's self is ",
      )
      .replace(
        /^my dad'?s name is /i,
        "User's father is ",
      )
      .replace(
        /^my father'?s name is /i,
        "User's father is ",
      )
      .replace(
        /^my mom'?s name is /i,
        "User's mother is ",
      )
      .replace(
        /^my mum'?s name is /i,
        "User's mother is ",
      )
      .replace(
        /^my mother'?s name is /i,
        "User's mother is ",
      )
      .replace(
        /^my sister'?s name is /i,
        "User's sister is ",
      )
      .replace(
        /^my brother'?s name is /i,
        "User's brother is ",
      )
      .replace(
        /^my best friend is /i,
        "User's best friend is ",
      )
      .replace(
        /^my dog'?s name is /i,
        "User's dog is ",
      )
      .replace(
        /^my puppy'?s name is /i,
        "User's dog is ",
      )
      .replace(
        /^my pet dog'?s name is /i,
        "User's dog is ",
      )
      .replace(
        /^my cat'?s name is /i,
        "User's cat is ",
      );
  }

  private normalizeProjectRelationship(
    content: string,
  ): string | null {
    const match = content.match(
      /^\s*[iI](?:\s+am|\s*'m)?\s+(?:building|creating|developing|making|coding|designing|working\s+on)\s+([A-Z][a-zA-Z]*)\s*$/u,
    );

    if (!match) {
      return null;
    }

    return `User's building is ${match[1]}`;
  }

  private normalizeIdentityRelationship(
    content: string,
  ): string | null {
    const match =
      content.match(/^\s*my\s+name\s+is\s+([A-Z][a-zA-Z]*)\s*$/iu) ??
      content.match(/^\s*[iI]\s+am\s+([A-Z][a-zA-Z]*)\s*$/u);

    if (!match || isBlockedUserIdentityName(match[1])) {
      return null;
    }

    return `User's self is ${match[1]}`;
  }

  private normalizePreferences(
    content: string,
  ): string {
    return content.replace(
      /^my favorite drink is /i,
      "User's favorite drink is ",
    );
  }

  private normalizeFacts(
    content: string,
  ): string {
    return content.replace(
      /^i live with my parents$/i,
      "User lives with parents",
    );
  }
}
