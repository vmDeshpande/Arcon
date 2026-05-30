import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

import {
  ExperienceRepository,
} from "../src/experience/experience-repository.js";

const DB_PATH =
  "./tests/experience-test.sqlite";

test(
  "creates experience",
  () => {
    rmSync(DB_PATH, {
      force: true,
    });

    const repo =
      new ExperienceRepository(
        DB_PATH,
      );

    const experience =
      repo.createExperience(
        "USER_ASKED_IDENTITY",
      );

    assert.equal(
      experience.count,
      1,
    );

    repo.close();
  },
);

test(
  "increments experience",
  () => {
    rmSync(DB_PATH, {
      force: true,
    });

    const repo =
      new ExperienceRepository(
        DB_PATH,
      );

    repo.incrementExperience(
      "USER_ASKED_IDENTITY",
    );

    const updated =
      repo.incrementExperience(
        "USER_ASKED_IDENTITY",
      );

    assert.equal(
      updated.count,
      2,
    );

    repo.close();
  },
);

test(
  "loads experience",
  () => {
    rmSync(DB_PATH, {
      force: true,
    });

    const repo =
      new ExperienceRepository(
        DB_PATH,
      );

    repo.incrementExperience(
      "USER_ASKED_IDENTITY",
    );

    const experience =
      repo.getExperience(
        "USER_ASKED_IDENTITY",
      );

    assert.ok(experience);

    assert.equal(
      experience?.count,
      1,
    );

    repo.close();
  },
);

test(
  "lists experiences",
  () => {
    rmSync(DB_PATH, {
      force: true,
    });

    const repo =
      new ExperienceRepository(
        DB_PATH,
      );

    repo.incrementExperience(
      "USER_ASKED_IDENTITY",
    );

    repo.incrementExperience(
      "USER_ASKED_ARCON_IDENTITY",
    );

    const experiences =
      repo.listExperiences();

    assert.equal(
      experiences.length,
      2,
    );

    repo.close();
  },
);