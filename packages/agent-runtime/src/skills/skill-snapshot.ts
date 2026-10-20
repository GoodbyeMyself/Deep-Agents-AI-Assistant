import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export interface SkillSnapshotSource {
  readonly name: string;
  readonly absolutePath: string;
  readonly artifactHash: string;
}

export interface SkillSnapshot {
  readonly workspaceRoot?: string;
  readonly skillPaths: readonly string[];
  dispose(): Promise<void>;
}

async function hashSkillTree(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error("Skill snapshot contains a symbolic link.");
      hash.update(relative(root, path).replaceAll("\\", "/"));
      if (stat.isDirectory()) await visit(path);
      else if (stat.isFile()) hash.update(await readFile(path));
      else throw new Error("Skill snapshot contains an unsupported file type.");
    }
  }
  await visit(root);
  return `sha256-${hash.digest("base64")}`;
}

export async function createSkillSnapshot(
  sources: readonly SkillSnapshotSource[],
): Promise<SkillSnapshot> {
  if (sources.length === 0) {
    return { skillPaths: [], dispose: () => Promise.resolve() };
  }
  const workspaceRoot = await mkdtemp(join(tmpdir(), "assistant-skill-snapshot-"));
  const skillsRoot = join(workspaceRoot, "skills");
  await mkdir(skillsRoot);
  try {
    for (const source of sources) {
      const target = join(skillsRoot, source.name);
      await cp(source.absolutePath, target, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      if ((await hashSkillTree(target)) !== source.artifactHash) {
        throw new Error(`Plugin Skill '${source.name}' changed after validation.`);
      }
    }
  } catch (error) {
    await rm(workspaceRoot, { recursive: true, force: true });
    throw error;
  }
  let active = true;
  return {
    workspaceRoot,
    skillPaths: Object.freeze(sources.map((source) => `/skills/${source.name}/`)),
    dispose: async () => {
      if (!active) return;
      active = false;
      await rm(workspaceRoot, { recursive: true, force: true });
    },
  };
}
