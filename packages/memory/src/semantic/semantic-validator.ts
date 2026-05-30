import type {
  SemanticMemory,
  ValidationResult,
} from "./semantic-types.js";

export class SemanticValidator {
  validate(
    memory: SemanticMemory,
  ): ValidationResult {
    if (!memory.content) {
      return {
        valid: false,
        reason: "Empty content",
      };
    }

    const content =
      memory.content.trim();

    if (
      content.length < 3
    ) {
      return {
        valid: false,
        reason: "Too short",
      };
    }

    if (
      content === "..."
    ) {
      return {
        valid: false,
        reason: "Placeholder content",
      };
    }

    if (
      content.toLowerCase() ===
      "unknown"
    ) {
      return {
        valid: false,
        reason: "Unknown content",
      };
    }

    if (
      memory.confidenceScore <= 0
    ) {
      return {
        valid: false,
        reason: "Invalid confidence",
      };
    }

    return {
      valid: true,
    };
  }
}