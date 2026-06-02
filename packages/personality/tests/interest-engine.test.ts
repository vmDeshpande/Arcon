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
});
