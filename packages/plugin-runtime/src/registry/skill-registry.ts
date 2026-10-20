import type { VerifiedPluginSkill } from "../lifecycle/types.js";

export interface PluginSkillLease {
  rollback(): void;
}

export class PluginSkillRegistry {
  readonly #skills = new Map<string, VerifiedPluginSkill>();

  registerMany(skills: readonly VerifiedPluginSkill[]): PluginSkillLease {
    const incoming = new Set<string>();
    for (const skill of skills) {
      if (skill.status !== "available") continue;
      if (incoming.has(skill.name) || this.#skills.has(skill.name)) {
        throw new Error(`Plugin Skill name conflict for '${skill.name}'.`);
      }
      incoming.add(skill.name);
    }
    for (const skill of skills) {
      if (skill.status === "available") this.#skills.set(skill.name, skill);
    }
    let active = true;
    return {
      rollback: () => {
        if (!active) return;
        active = false;
        for (const skill of skills) {
          if (this.#skills.get(skill.name) === skill) this.#skills.delete(skill.name);
        }
      },
    };
  }

  list(): readonly VerifiedPluginSkill[] {
    return [...this.#skills.values()];
  }
}
