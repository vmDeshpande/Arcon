import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InterestEngine } from "../src/interest/index.js";
import { MemoryRepository } from "@arcon/memory";

function createContext() {
  const dir = mkdtempSync(join(tmpdir(), "arcon-interest-"));
  const repo = new MemoryRepository(join(dir, "memories.sqlite"));
  const engine = new InterestEngine(repo);
  return { dir, repo, engine };
}

describe("InterestEngine extraction rules", () => {
  it("does not extract interests from 'My name is Vedant'", () => {
    const { repo, engine } = createContext();

    engine.updateFromText("My name is Vedant");

    const rows = repo.listInterests();
    assert.equal(rows.length, 0);

    repo.close();
  });

  it("does not extract interests from 'My sister is Madhura'", () => {
    const { repo, engine } = createContext();

    engine.updateFromText("My sister is Madhura");

    const rows = repo.listInterests();
    assert.equal(rows.length, 0);

    repo.close();
  });

  it("extracts 'buttermilk' from 'I like buttermilk'", () => {
    const { repo, engine } = createContext();

    engine.updateFromText("I like buttermilk");

    const rows = repo.listInterests();
    assert.ok(rows.some((r) => r.topic === "buttermilk"));

    repo.close();
  });

  it("extracts 'travel' from 'I enjoy travel'", () => {
    const { repo, engine } = createContext();

    engine.updateFromText("I enjoy travel");

    const rows = repo.listInterests();
    assert.ok(rows.some((r) => r.topic === "travel"));

    repo.close();
  });

  it("does not extract from greetings", () => {
    const { repo, engine } = createContext();

    engine.updateFromText("Hello Arcon how are you today");

    const rows = repo.listInterests();
    assert.equal(rows.length, 0);

    repo.close();
  });

  it("stores Arcon interests separately from user interests", () => {
    const { repo, engine } = createContext();

    engine.updateArconFromText("I am building Arcon with programming and memory systems", {
      curiosity: 0.7,
      happiness: 0.4,
      trust: 0.4,
    });

    const userInterests = repo.listInterests();
    const arconInterests = repo.listArconInterests();

    assert.equal(userInterests.length, 0);
    assert.ok(arconInterests.some((interest) => interest.topic === "programming"));
    assert.ok(arconInterests.some((interest) => interest.topic === "memory systems"));

    repo.close();
  });

  it("increases Arcon interest weights through repeated curious conversations", () => {
    const { repo, engine } = createContext();

    engine.updateArconFromText("Programming and AI systems are important here", {
      curiosity: 0.5,
      happiness: 0.2,
      trust: 0.2,
    });
    const first = repo.getArconInterest("programming")?.weight ?? 0;

    engine.updateArconFromText("I want you to learn more about programming", {
      curiosity: 0.8,
      happiness: 0.5,
      trust: 0.5,
    });
    const second = repo.getArconInterest("programming")?.weight ?? 0;

    assert.ok(second > first);

    repo.close();
  });
});
