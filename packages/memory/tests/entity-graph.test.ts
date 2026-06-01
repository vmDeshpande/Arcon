import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ConversationEntityTracker } from "../src/conversation/conversation-entity-tracker.js";
import { EntityFactRepository } from "../src/entity/entity-fact-repository.js";
import { EntityKnowledgeBuilder } from "../src/entity/entity-knowledge-builder.js";
import { EntityMemoryLinker } from "../src/entity/entity-memory-linker.js";
import { EntityRepository } from "../src/entity/entity-repository.js";
import { MemoryRetriever } from "../src/retrieval/memory-retriever.js";
import {
  MemoryRepository,
  MemorySourceType,
  MemoryType,
} from "../src/personal-memory.js";
import type { SemanticMemory } from "../src/semantic/semantic-types.js";

function createRepository() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-entities-"));
  return new EntityRepository(join(dir, "entities.sqlite"));
}

function createMemoryRepository() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-memories-"));
  return new MemoryRepository(join(dir, "memories.sqlite"));
}

function memory(content: string, type = "FACT"): SemanticMemory {
  return {
    type,
    content,
    confidenceScore: 0.95,
    importanceScore: 6,
  };
}

test("conversation tracker preserves existing entity type for direct facts", () => {
  const repository = createRepository();
  repository.createEntity("Murphy", "PET");

  const tracker = new ConversationEntityTracker(repository);
  tracker.update([memory("Murphy likes dog food", "PREFERENCE")]);

  assert.equal(tracker.getActiveEntity()?.name, "Murphy");
  assert.equal(tracker.getActiveEntity()?.type, "PET");

  repository.close();
});

test("conversation tracker uses relationship type for newly introduced entities", () => {
  const tracker = new ConversationEntityTracker();

  tracker.update([
    memory("User's dog is Murphy", "RELATIONSHIP"),
    memory("Murphy likes dog food", "PREFERENCE"),
  ]);

  assert.equal(tracker.getActiveEntity()?.name, "Murphy");
  assert.equal(tracker.getActiveEntity()?.type, "PET");
});

test("knowledge builder creates entities from relationship-backed facts", () => {
  const repository = createRepository();
  const factRepository = new EntityFactRepository(repository.getDatabase());
  const linker = new EntityMemoryLinker(repository);
  const builder = new EntityKnowledgeBuilder(repository, factRepository);
  const memories = [
    memory("User's dog is Murphy", "RELATIONSHIP"),
    memory("Murphy likes dog food", "PREFERENCE"),
  ];

  linker.link(memories);
  builder.build(memories);

  const murphy = repository.findByName("Murphy");
  assert.equal(murphy?.type, "PET");
  assert.deepEqual(
    factRepository.getFacts(murphy!.id).map((fact) => fact.fact),
    ["likes dog food"],
  );

  repository.close();
});

test("knowledge builder creates unknown entities from orphaned facts", () => {
  const repository = createRepository();
  const factRepository = new EntityFactRepository(repository.getDatabase());
  const builder = new EntityKnowledgeBuilder(repository, factRepository);

  builder.build([memory("Milind likes buttermilk", "PREFERENCE")]);

  const milind = repository.findByName("Milind");
  assert.equal(milind?.type, "UNKNOWN");
  assert.deepEqual(
    factRepository.getFacts(milind!.id).map((fact) => fact.fact),
    ["likes buttermilk"],
  );

  repository.close();
});

test("knowledge builder infers pet entities from orphaned pet-food facts", () => {
  const repository = createRepository();
  const factRepository = new EntityFactRepository(repository.getDatabase());
  const builder = new EntityKnowledgeBuilder(repository, factRepository);

  builder.build([memory("Murphy likes dog food", "PREFERENCE")]);

  assert.equal(repository.findByName("Murphy")?.type, "PET");

  repository.close();
});

test("relationship graph creates user father relationship", () => {
  const repository = createRepository();
  const linker = new EntityMemoryLinker(repository);

  linker.link([memory("User's father is Milind", "RELATIONSHIP")]);

  const user = repository.findByName("User");
  const milind = repository.findByName("Milind");

  assert.equal(user?.type, "USER");
  assert.equal(milind?.type, "PERSON");
  assert(
    repository
      .listLinks()
      .some(
        (link) =>
          link.source_entity_id === user?.id &&
          link.target_entity_id === milind?.id &&
          link.relation === "father",
      ),
  );

  repository.close();
});

test("relationship graph creates user self identity", () => {
  const repository = createRepository();
  const linker = new EntityMemoryLinker(repository);

  linker.link([memory("User's self is Vedant", "RELATIONSHIP")]);

  const vedant = repository.findByName("Vedant");
  const user = repository.findByName("User");

  assert.equal(vedant?.type, "USER");
  assert.equal(repository.resolveRelationship(user!.id, "self")?.name, "Vedant");

  repository.close();
});

test("relationship graph creates building project relationship", () => {
  const repository = createRepository();
  const linker = new EntityMemoryLinker(repository);

  linker.link([memory("User is building Arcon", "PROJECT")]);

  const arcon = repository.findByName("Arcon");
  const user = repository.findByName("User");

  assert.equal(arcon?.type, "PROJECT");
  assert.equal(
    repository.resolveRelationship(user!.id, "building")?.name,
    "Arcon",
  );

  repository.close();
});

test("final graph for identity and project excludes action-word user entities", () => {
  const repository = createRepository();
  const factRepository = new EntityFactRepository(repository.getDatabase());
  const linker = new EntityMemoryLinker(repository);
  const builder = new EntityKnowledgeBuilder(repository, factRepository);
  const memories = [
    memory("User's self is Vedant", "RELATIONSHIP"),
    memory("User's building is Arcon", "RELATIONSHIP"),
    memory("Arcon is being built", "FACT"),
    memory("User's self is building", "RELATIONSHIP"),
  ];

  linker.link(memories);
  builder.build(memories);

  const user = repository.findByName("User");
  const entities = repository.listEntities();

  assert.deepEqual(
    entities.map((entity) => [entity.name, entity.type]).sort(),
    [
      ["Arcon", "PROJECT"],
      ["User", "USER"],
      ["Vedant", "USER"],
    ].sort(),
  );
  assert.equal(repository.resolveRelationship(user!.id, "self")?.name, "Vedant");
  assert.equal(
    repository.resolveRelationship(user!.id, "building")?.name,
    "Arcon",
  );
  assert.equal(repository.findByName("building"), null);
  assert.deepEqual(
    factRepository
      .getFacts(repository.findByName("Arcon")!.id)
      .map((fact) => fact.fact),
    ["is being built"],
  );

  repository.close();
});

test("knowledge builder ignores redundant entity-only facts", () => {
  const repository = createRepository();
  const factRepository = new EntityFactRepository(repository.getDatabase());
  const builder = new EntityKnowledgeBuilder(repository, factRepository);

  builder.build([
    memory("Vedant's name is Vedant", "FACT"),
    memory("Madhura's name is Madhura", "FACT"),
    memory("Arcon is Arcon", "FACT"),
    memory("Arcon", "PROJECT"),
    memory("PROJECT: Arcon", "PROJECT"),
    memory("Entity: Arcon", "FACT"),
  ]);

  assert.deepEqual(repository.listEntities(), []);
  assert.deepEqual(factRepository.listFacts(), []);

  repository.close();
});

test("project action words are never created as user entities", () => {
  for (const action of [
    "building",
    "creating",
    "developing",
    "making",
    "working",
    "coding",
    "designing",
  ]) {
    const repository = createRepository();
    const linker = new EntityMemoryLinker(repository);

    linker.link([memory(`User's self is ${action}`, "RELATIONSHIP")]);

    assert.equal(repository.findByName(action), null);

    repository.close();
  }
});

test("entity-centric retrieval resolves relationship target facts", () => {
  const entityRepository = createRepository();
  const memoryRepository = createMemoryRepository();
  const factRepository = new EntityFactRepository(
    entityRepository.getDatabase(),
  );
  const linker = new EntityMemoryLinker(entityRepository);
  const builder = new EntityKnowledgeBuilder(entityRepository, factRepository);
  const memories = [
    memory("User's father is Milind", "RELATIONSHIP"),
    memory("Milind likes buttermilk", "PREFERENCE"),
    memory("Murphy likes dog food", "PREFERENCE"),
  ];

  linker.link(memories);
  builder.build(memories);
  memoryRepository.createMemory({
    type: MemoryType.PREFERENCE,
    content: "Milind likes buttermilk",
    importanceScore: 6,
    confidenceScore: 0.95,
    sourceType: MemorySourceType.INFERRED,
  });
  memoryRepository.createMemory({
    type: MemoryType.PREFERENCE,
    content: "Murphy likes dog food",
    importanceScore: 6,
    confidenceScore: 0.95,
    sourceType: MemorySourceType.INFERRED,
  });

  const retriever = new MemoryRetriever(
    memoryRepository,
    entityRepository,
    factRepository,
  );

  const results = retriever.retrieveRelevantMemories(
    "What does my father like?",
  );

  assert(results.some((result) => result.content === "Milind likes buttermilk"));
  assert(!results.some((result) => result.content.includes("Murphy")));

  memoryRepository.close();
  entityRepository.close();
});
