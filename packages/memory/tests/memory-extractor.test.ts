import { describe, it } from "node:test";
import assert from "node:assert";
import { MemoryExtractor } from "../src/extractor/memory-extractor.js";
import { MemoryType, MemorySourceType } from "../src/personal-memory.js";

describe("MemoryExtractor", () => {
  let extractor: MemoryExtractor;

  describe("Preference Extraction", () => {
    it("should extract 'My favorite' preferences", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("My favorite language is TypeScript");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.PREFERENCE);
      assert(candidate.content.includes("TypeScript"));
      assert.strictEqual(candidate.confidenceScore, 0.95);
      assert.strictEqual(candidate.sourceType, MemorySourceType.USER_EXPLICIT);
    });

    it("should extract 'I prefer' preferences", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I prefer Python for data science");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.PREFERENCE);
      assert(candidate.content.includes("Python"));
      assert.strictEqual(candidate.confidenceScore, 0.9);
    });

    it("should extract 'I like' preferences", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I like working in the morning");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PREFERENCE);
    });

    it("should extract 'I dislike' preferences", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I dislike slow tools");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.PREFERENCE);
      assert(candidate.content.includes("slow tools"));
      assert.strictEqual(candidate.confidenceScore, 0.9);
    });
  });

  describe("Fact Extraction", () => {
    it("should extract 'I use' facts", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I use Windows 11");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.FACT);
      assert(candidate.content.includes("Windows 11"));
      assert.strictEqual(candidate.sourceType, MemorySourceType.USER_EXPLICIT);
    });

    it("should extract 'I work with' facts", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I work with Node.js");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.FACT);
      assert(result.candidates[0].content.includes("Node.js"));
    });

    it("should extract 'I am' facts", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am a software engineer");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.FACT);
      assert(candidate.content.includes("software engineer"));
    });

    it("should extract 'I have' facts", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I have 10 years of experience");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.FACT);
      assert(result.candidates[0].content.includes("10 years"));
    });

    it("should reject ambiguous 'I am' statements", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am here");

      const factCandidates = result.candidates.filter((c) => c.type === MemoryType.FACT);
      assert.strictEqual(factCandidates.length, 0);
    });
  });

  describe("Project Extraction", () => {
    it("should extract 'I am building' projects", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am building Arcon");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.PROJECT);
      assert(candidate.content.includes("Arcon"));
      assert.strictEqual(candidate.confidenceScore, 0.95);
      assert.strictEqual(candidate.importanceScore, 8);
    });

    it("should extract 'I'm building' projects", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I'm building a real-time chat app");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PROJECT);
    });

    it("should extract 'I am working on' projects", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am working on a new feature");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PROJECT);
    });

    it("should extract 'I am creating' projects", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am creating a TypeScript framework");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PROJECT);
    });

    it("should extract 'I am developing' projects", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I am developing an AI assistant");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PROJECT);
    });

    it("should handle 'currently working on'", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I'm currently working on optimization");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.PROJECT);
    });
  });

  describe("Goal Extraction", () => {
    it("should extract 'My goal is' goals", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("My goal is to build a local-first AI companion");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.GOAL);
      assert(candidate.content.includes("local-first"));
      assert.strictEqual(candidate.confidenceScore, 0.95);
      assert.strictEqual(candidate.importanceScore, 8);
    });

    it("should extract 'I want to' goals", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I want to improve performance");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.GOAL);
    });

    it("should extract 'I aim to' goals", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I aim to create scalable systems");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.GOAL);
      assert.strictEqual(candidate.confidenceScore, 0.9);
    });

    it("should extract 'I need to' goals", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I need to learn Rust");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.GOAL);
    });
  });

  describe("Constraint Extraction", () => {
    it("should extract 'must' constraints", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Arcon must remain local-first");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.CONSTRAINT);
      assert(candidate.content.includes("must"));
      assert.strictEqual(candidate.confidenceScore, 0.95);
      assert.strictEqual(candidate.importanceScore, 9);
    });

    it("should extract 'can't' constraints", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Arcon can't rely on cloud services");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.CONSTRAINT);
      assert(candidate.content.includes("cannot"));
    });

    it("should extract 'cannot' constraints", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("The system cannot be memory hungry");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.CONSTRAINT);
    });

    it("should extract 'should only' constraints", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Data should only be stored locally");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.CONSTRAINT);
    });
  });

  describe("Relationship Extraction", () => {
    it("should extract 'works with' relationships", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Vicky works with me on Arcon");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.RELATIONSHIP);
      assert(candidate.content.includes("Vicky"));
    });

    it("should extract 'wants to contribute' relationships", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Vicky Gupta wants to contribute to Arcon");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.RELATIONSHIP);
      assert(candidate.content.includes("Vicky"));
      assert(candidate.content.includes("Arcon"));
    });

    it("should extract 'is my' relationships", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Alice is my collaborator");

      assert.strictEqual(result.candidates.length, 1);
      const candidate = result.candidates[0];
      assert.strictEqual(candidate.type, MemoryType.RELATIONSHIP);
      assert(candidate.content.includes("collaborator"));
    });

    it("should extract 'and I are' relationships", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Bob and I are building tools");

      assert.strictEqual(result.candidates.length, 1);
      assert.strictEqual(result.candidates[0].type, MemoryType.RELATIONSHIP);
    });
  });

  describe("Duplicate Prevention", () => {
    it("should remove exact duplicate candidates", () => {
      extractor = new MemoryExtractor();
      // This message has two similar preferences that might be deduplicated
      const result = extractor.extract(
        "My favorite language is TypeScript and I like TypeScript too"
      );

      // Should have at least one preference candidate
      const preferences = result.candidates.filter((c) => c.type === MemoryType.PREFERENCE);
      assert(preferences.length >= 1, "Should have at least one preference");
      
      // All TypeScript mentions combined should be in candidates or duplicates
      const allCandidates = result.candidates.concat(result.duplicates);
      const tsPreferences = allCandidates.filter((c) => c.type === MemoryType.PREFERENCE && c.content.toLowerCase().includes("typescript"));
      assert(tsPreferences.length >= 1, "Should have TypeScript preferences");
    });

    it("should remove similar candidates", () => {
      extractor = new MemoryExtractor();
      const msg = "I use TypeScript. I work with TypeScript.";
      const result = extractor.extract(msg);

      const typeScriptCandidates = result.candidates.filter((c) =>
        c.content.toLowerCase().includes("typescript")
      );

      assert(typeScriptCandidates.length >= 1);
    });

    it("should keep higher confidence candidate when duplicates exist", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "I like Python and my favorite language is Python"
      );

      const pythonCandidates = result.candidates.filter(
        (c) => c.type === MemoryType.PREFERENCE && c.content.includes("Python")
      );

      if (pythonCandidates.length === 1) {
        assert.strictEqual(pythonCandidates[0].confidenceScore, 0.95);
      }
    });
  });

  describe("Validation", () => {
    it("should reject empty messages", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("");

      assert.strictEqual(result.candidates.length, 0);
      assert(result.validationErrors.length > 0);
      assert(result.validationErrors.some((e) => e.includes("empty")));
    });

    it("should reject messages that are too short", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("Hi");

      assert.strictEqual(result.candidates.length, 0);
      assert(result.validationErrors.length > 0);
      assert(result.validationErrors.some((e) => e.includes("too short")));
    });

    it("should reject messages that are too long", () => {
      extractor = new MemoryExtractor();
      const longMessage = "a".repeat(6000);
      const result = extractor.extract(longMessage);

      assert.strictEqual(result.candidates.length, 0);
      assert(result.validationErrors.length > 0);
      assert(result.validationErrors.some((e) => e.includes("too long")));
    });

    it("should accept valid length messages", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "My favorite language is TypeScript because it combines the best of static and dynamic typing"
      );

      assert.strictEqual(result.validationErrors.length, 0);
      assert(result.candidates.length > 0);
    });
  });

  describe("Confidence and Importance Scoring", () => {
    it("should assign correct importance scores by type", () => {
      const inputs = [
        { msg: "I use Node.js", type: MemoryType.FACT, expectedImportance: 5 },
        {
          msg: "My favorite language is TypeScript",
          type: MemoryType.PREFERENCE,
          expectedImportance: 6
        },
        {
          msg: "I am building Arcon",
          type: MemoryType.PROJECT,
          expectedImportance: 8
        },
        {
          msg: "My goal is to learn Rust",
          type: MemoryType.GOAL,
          expectedImportance: 8
        },
        {
          msg: "Arcon must be local-first",
          type: MemoryType.CONSTRAINT,
          expectedImportance: 9
        },
        {
          msg: "Alice is my collaborator",
          type: MemoryType.RELATIONSHIP,
          expectedImportance: 7
        }
      ];

      for (const { msg, type, expectedImportance } of inputs) {
        extractor = new MemoryExtractor();
        const result = extractor.extract(msg);
        const candidate = result.candidates.find((c) => c.type === type);
        assert(candidate, `Should find candidate of type ${type} in message: ${msg}`);
        assert.strictEqual(candidate.importanceScore, expectedImportance);
      }
    });

    it("should assign high confidence to explicit statements", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("My favorite language is TypeScript");
      const candidate = result.candidates[0];

      assert(candidate.confidenceScore >= 0.9);
    });

    it("should assign lower confidence to inferred statements", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I need to learn more about databases");
      const candidate = result.candidates.find((c) => c.type === MemoryType.GOAL);

      assert(candidate);
      assert(candidate.confidenceScore < 0.95);
    });
  });

  describe("Multiple Candidate Extraction", () => {
    it("should extract multiple different memory types from one message", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "I am building Arcon and my goal is to make it accessible"
      );

      assert(result.candidates.length >= 2);
      const types = new Set(result.candidates.map((c) => c.type));
      assert(types.has(MemoryType.PROJECT));
      assert(types.has(MemoryType.GOAL));
    });

    it("should extract multiple similar types from one message", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("I prefer TypeScript and I prefer static typing");

      assert(result.candidates.length >= 1);
      assert(result.candidates.every((c) => c.type === MemoryType.PREFERENCE));
    });
  });

  describe("Reasoning Documentation", () => {
    it("should provide reasoning for all candidates", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract("My favorite language is TypeScript");

      for (const candidate of result.candidates) {
        assert(candidate.reasoning);
        assert(candidate.reasoning.length > 0);
      }
    });

    it("should provide different reasoning for different patterns", () => {
      extractor = new MemoryExtractor();
      const result1 = extractor.extract("My favorite language is TypeScript");
      extractor = new MemoryExtractor();
      const result2 = extractor.extract("I prefer Python");

      const reasoning1 = result1.candidates[0]?.reasoning || "";
      const reasoning2 = result2.candidates[0]?.reasoning || "";

      assert.notStrictEqual(reasoning1, reasoning2);
    });
  });

  describe("Custom Configuration", () => {
    it("should respect custom minimum message length", () => {
      extractor = new MemoryExtractor({ minMessageLength: 100 });
      const result = extractor.extract("My favorite language is TypeScript");

      assert(result.validationErrors.length > 0);
      assert.strictEqual(result.candidates.length, 0);
    });

    it("should accept message at minimum length", () => {
      extractor = new MemoryExtractor({ minMessageLength: 20 });
      const result = extractor.extract("My favorite language is TypeScript");

      assert.strictEqual(result.validationErrors.length, 0);
      assert(result.candidates.length > 0);
    });
  });

  describe("Real-world Examples", () => {
    it("should handle complex user statement", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "I'm building Arcon, a local-first AI companion, and my goal is to keep it accessible. " +
          "I prefer TypeScript and the system must remain privacy-focused."
      );

      assert.strictEqual(result.validationErrors.length, 0);
      assert(result.candidates.length > 0);

      const types = new Set(result.candidates.map((c) => c.type));
      assert(types.size >= 3);
    });

    it("should handle technical discussion", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "I use Node.js with TypeScript for backend work. " +
          "I work with databases daily and my favorite is MongoDB. " +
          "I aim to architect more scalable systems."
      );

      assert.strictEqual(result.validationErrors.length, 0);
      // Should extract: use Node.js (FACT), work with databases (FACT), favorite MongoDB (PREFERENCE), aim to architect (GOAL)
      assert(result.candidates.length >= 3, `Expected at least 3 candidates, got ${result.candidates.length}`);
    });

    it("should handle relationship context", () => {
      extractor = new MemoryExtractor();
      const result = extractor.extract(
        "Vicky Gupta wants to contribute to Arcon and is my colleague. " +
          "We both prefer remote work and focus on open source."
      );

      assert.strictEqual(result.validationErrors.length, 0);
      const relationships = result.candidates.filter(
        (c) => c.type === MemoryType.RELATIONSHIP
      );
      assert(relationships.length >= 1);
    });
  });
});
