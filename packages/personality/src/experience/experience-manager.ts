import {
  Experience,
} from "./experience.js";

import {
  ExperienceRepository,
} from "./experience-repository.js";

export class ExperienceManager {
  constructor(
    private readonly repository:
      ExperienceRepository,
  ) {}

  record(
    type: string,
  ): void {
    this.repository
      .incrementExperience(type);
  }

  getCount(
    type: string,
  ): number {
    return (
      this.repository
        .getExperience(type)
        ?.count ?? 0
    );
  }

  list(): Experience[] {
    return this.repository
      .listExperiences();
  }
}