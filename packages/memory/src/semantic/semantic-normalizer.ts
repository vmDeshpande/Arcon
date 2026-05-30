import type {
  SemanticMemory,
} from "./semantic-types.js";
import { normalizeRelationshipContent } from "../entity/entity-relationship-extractor.js";

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
    return normalizeRelationshipContent(content)
      .replace(
        /^my name is /i,
        "User's self is ",
      )
      .replace(
        /^i am ([A-Z][a-zA-Z]*)$/i,
        "User's self is $1",
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
