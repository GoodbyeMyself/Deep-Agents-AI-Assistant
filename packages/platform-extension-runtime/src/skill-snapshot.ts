import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PlatformExtensionSnapshot } from "./types.js";

const MAX_SKILL_FILES = 128;
const MAX_SKILL_BYTES = 2 * 1024 * 1024;

interface SkillFile {
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly size: number;
}

async function collectSkillFiles(root: string): Promise<readonly SkillFile[]> {
  const files: SkillFile[] = [];
  let totalBytes = 0;
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => (left.name === right.name ? 0 : left.name < right.name ? -1 : 1));
    for (const entry of entries) {
      const sourcePath = path.join(current, entry.name);
      const stats = await lstat(sourcePath);
      if (stats.isSymbolicLink())
        throw new Error("Platform Skill directories cannot contain symbolic links.");
      if (stats.isDirectory()) {
        await visit(sourcePath);
        continue;
      }
      if (!stats.isFile())
        throw new Error("Platform Skill directories may contain only files and directories.");
      files.push({
        relativePath: path.relative(root, sourcePath).split(path.sep).join("/"),
        sourcePath,
        size: stats.size,
      });
      totalBytes += stats.size;
      if (files.length > MAX_SKILL_FILES)
        throw new Error("Platform Skill contains too many files.");
      if (totalBytes > MAX_SKILL_BYTES) {
        throw new Error("Platform Skill exceeds the total size limit.");
      }
    }
  }
  await visit(root);
  if (!files.some((file) => file.relativePath === "SKILL.md")) {
    throw new Error("Platform Skill must contain SKILL.md at its root.");
  }
  return Object.freeze(files);
}

async function skillDigest(files: readonly SkillFile[]): Promise<string> {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath, "utf8").update("\0", "utf8");
    const content = await readFile(file.sourcePath);
    hash.update(content).update("\0", "utf8");
  }
  return hash.digest("hex");
}

async function validateSkillDocument(files: readonly SkillFile[], skillId: string): Promise<void> {
  const document = files.find((file) => file.relativePath === "SKILL.md");
  if (document === undefined) throw new Error(`Platform Skill '${skillId}' is missing SKILL.md.`);
  const content = await readFile(document.sourcePath, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (frontmatter === undefined) {
    throw new Error(`Platform Skill '${skillId}' has invalid frontmatter.`);
  }
  const fields = new Map<string, string>();
  for (const line of frontmatter.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error(`Platform Skill '${skillId}' has invalid frontmatter.`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key !== "name" && key !== "description") {
      throw new Error(`Platform Skill '${skillId}' has unsupported frontmatter field '${key}'.`);
    }
    if (fields.has(key) || value.length === 0) {
      throw new Error(`Platform Skill '${skillId}' has invalid frontmatter field '${key}'.`);
    }
    fields.set(key, value);
  }
  if (fields.get("name") !== skillId || (fields.get("description")?.length ?? 0) > 500) {
    throw new Error(`Platform Skill '${skillId}' frontmatter does not match its Manifest.`);
  }
}

function skillSnapshotName(extensionId: string, skillId: string): string {
  return `${extensionId}__${skillId}`.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export async function createPlatformSkillSnapshot(snapshot: PlatformExtensionSnapshot): Promise<{
  readonly workspaceRoot?: string;
  readonly skills: readonly string[];
  close(): Promise<void>;
}> {
  const contributions = snapshot.approved.flatMap(({ definition }) =>
    definition.manifest.contributes.skills.map((skill) => ({ definition, skill })),
  );
  if (contributions.length === 0) {
    return Object.freeze({ skills: Object.freeze([]), close: () => Promise.resolve() });
  }

  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "assistant-platform-extensions-"));
  const skillsRoot = path.join(workspaceRoot, "skills");
  const skillPaths: string[] = [];
  try {
    await mkdir(skillsRoot, { recursive: true });
    for (const { definition, skill } of contributions) {
      const extensionRoot = await realpath(definition.rootDirectory);
      const declaredSource = path.resolve(extensionRoot, skill.path);
      const declaredStats = await lstat(declaredSource);
      if (declaredStats.isSymbolicLink()) {
        throw new Error(`Platform Skill '${skill.id}' path cannot be a symbolic link.`);
      }
      const source = await realpath(declaredSource);
      const sourceRelativeToExtension = path.relative(extensionRoot, source);
      if (
        sourceRelativeToExtension.length === 0 ||
        sourceRelativeToExtension.startsWith(`..${path.sep}`) ||
        path.isAbsolute(sourceRelativeToExtension)
      ) {
        throw new Error(`Platform Skill '${skill.id}' resolves outside its extension root.`);
      }
      const stats = await lstat(source);
      if (!stats.isDirectory())
        throw new Error(`Platform Skill '${skill.id}' must be a directory.`);
      const files = await collectSkillFiles(source);
      await validateSkillDocument(files, skill.id);
      if ((await skillDigest(files)) !== skill.contentDigest) {
        throw new Error(
          `Platform Skill content drift for '${definition.manifest.id}/${skill.id}'.`,
        );
      }
      const snapshotName = skillSnapshotName(definition.manifest.id, skill.id);
      const destination = path.join(skillsRoot, snapshotName);
      for (const file of files) {
        const target = path.join(destination, ...file.relativePath.split("/"));
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(file.sourcePath, target);
      }
      skillPaths.push(`/skills/${snapshotName}`);
    }
    return Object.freeze({
      workspaceRoot,
      skills: Object.freeze(skillPaths),
      close: () => rm(workspaceRoot, { recursive: true, force: true }),
    });
  } catch (error) {
    await rm(workspaceRoot, { recursive: true, force: true });
    throw error;
  }
}
