import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { SUPPORTED_PLUGIN_API_VERSIONS } from "@assistant/plugin-sdk";

import { lifecycle, failedRecord } from "../lifecycle/record.js";
import type {
  PluginCapabilityDiagnostic,
  PluginLifecycleEvent,
  PluginFailureStage,
  PluginRuntimeOptions,
  PluginRuntimeRecord,
} from "../lifecycle/types.js";
import { pluginManifestSchema, type PluginManifest } from "../manifest/schema.js";

export interface ValidatedCandidate {
  readonly pluginPath: string;
  readonly manifest: PluginManifest;
  readonly entryPath?: string;
  readonly skills: readonly ValidatedSkillCandidate[];
  readonly artifactHash: string;
  readonly events: readonly PluginLifecycleEvent[];
}

export interface ValidatedSkillCandidate {
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly absolutePath: string;
  readonly artifactHash: string;
  readonly requiredCapabilities: readonly {
    readonly id: string;
    readonly contractVersion: string;
  }[];
  readonly requiredToolNames: readonly string[];
  readonly requiredConfig: readonly string[];
  readonly requiredCredentials: readonly string[];
}

function manifestSkillPaths(manifest: PluginManifest): readonly string[] {
  if (manifest.manifestVersion !== "2") return [];
  return (manifest.skills ?? []).map((skill) =>
    typeof skill === "string" ? skill : skill.path,
  );
}

function capabilityToolName(capabilityId: string): string {
  return capabilityId.replaceAll(/[^a-zA-Z0-9_]/g, "_");
}

function parseSkillFrontmatter(content: string, directoryName: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (!match) return undefined;
  const values = new Map<string, string>();
  for (const line of match[1]?.split(/\r?\n/u) ?? []) {
    if (line.trim().length === 0) continue;
    const separator = line.indexOf(":");
    if (separator < 1) return undefined;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (values.has(key)) return undefined;
    values.set(key, value);
  }
  const name = values.get("name");
  const description = values.get("description");
  if (
    name === undefined ||
    description === undefined ||
    name !== directoryName ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) ||
    name.length > 64 ||
    description.length < 1 ||
    description.length > 1024
  ) {
    return undefined;
  }
  return { name, description, allowedTools: values.get("allowed-tools") };
}

export function capabilityDiagnostics(
  manifest: PluginManifest,
): readonly PluginCapabilityDiagnostic[] {
  if (manifest.manifestVersion === "1") {
    return manifest.capabilities.map((declaration) => ({
      id: declaration.id,
      contractVersion: declaration.contractVersion,
    }));
  }
  return manifest.capabilities.map((declaration) => ({
    id: declaration.id,
    contractVersion: declaration.contractVersion,
    contractSource: declaration.contractSource,
    requiredPermission: declaration.requiredPermission,
    riskLevel: declaration.riskLevel,
  }));
}

function candidateFailure(
  pluginPath: string,
  events: readonly PluginLifecycleEvent[],
  stage: PluginFailureStage,
  errorCode: string,
  message: string,
  manifest?: PluginManifest,
  artifactHash?: string,
): PluginRuntimeRecord {
  return failedRecord({
    pluginPath,
    events,
    errorCode,
    message,
    failureStage: stage,
    ...(manifest === undefined
      ? {}
      : {
          pluginId: manifest.id,
          pluginVersion: manifest.version,
          manifestVersion: manifest.manifestVersion,
          capabilities: capabilityDiagnostics(manifest),
          ...(manifest.manifestVersion === "2"
            ? { namespace: manifest.namespace, skillPaths: manifestSkillPaths(manifest) }
            : {}),
        }),
    ...(artifactHash === undefined ? {} : { artifactHash }),
  });
}

function isInside(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

async function assertNoSymlinkSegments(root: string, target: string): Promise<void> {
  const relativePath = relative(root, target);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("outside root");
  }
  let current = root;
  for (const segment of relativePath.split(/[\\/]/u)) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new Error("symlink");
  }
}

async function sha256(path: string): Promise<string> {
  return `sha256-${createHash("sha256")
    .update(await readFile(path))
    .digest("base64")}`;
}

async function hashAndVerifySkillTree(root: string): Promise<string> {
  const hash = createHash("sha256");
  let totalBytes = 0;
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error("symlink");
      const relativePath = relative(root, path).replaceAll("\\", "/");
      hash.update(relativePath);
      if (stat.isDirectory()) {
        await visit(path);
      } else if (stat.isFile()) {
        totalBytes += stat.size;
        if (stat.size > 512 * 1024 || totalBytes > 2 * 1024 * 1024) {
          throw new Error("size");
        }
        hash.update(await readFile(path));
      } else {
        throw new Error("type");
      }
    }
  }
  await visit(root);
  return `sha256-${hash.digest("base64")}`;
}

export async function validateCandidate(
  pluginPath: string,
  options: PluginRuntimeOptions,
): Promise<ValidatedCandidate | PluginRuntimeRecord> {
  const events = [lifecycle("discovered", "Plugin manifest discovered.")];
  const manifestPath = resolve(pluginPath, "plugin.json");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch {
    return candidateFailure(
      pluginPath,
      events,
      "manifest",
      "MANIFEST_READ_FAILED",
      "Plugin manifest could not be read as JSON.",
    );
  }

  const parsedManifest = pluginManifestSchema.safeParse(parsedJson);
  if (!parsedManifest.success) {
    return candidateFailure(
      pluginPath,
      events,
      "manifest",
      "MANIFEST_INVALID",
      "Plugin manifest does not satisfy protocol version 1 or 2.",
    );
  }
  const manifest = parsedManifest.data;
  if (!(SUPPORTED_PLUGIN_API_VERSIONS as readonly string[]).includes(manifest.apiVersion)) {
    return candidateFailure(
      pluginPath,
      events,
      "manifest",
      "API_VERSION_UNSUPPORTED",
      "Plugin API version is not supported.",
      manifest,
    );
  }
  if (!options.approvedPluginIds.has(manifest.id)) {
    return candidateFailure(
      pluginPath,
      events,
      "approval",
      "PLUGIN_NOT_APPROVED",
      "Plugin is not present in the deployment approval list.",
      manifest,
    );
  }
  if (manifest.manifestVersion === "2") {
    if (!options.approvedNamespaces?.has(manifest.namespace)) {
      return candidateFailure(
        pluginPath,
        events,
        "approval",
        "NAMESPACE_NOT_APPROVED",
        "Plugin namespace is not present in the deployment approval list.",
        manifest,
      );
    }
    for (const declaration of manifest.capabilities) {
      if (declaration.riskLevel !== "read") {
        return candidateFailure(
          pluginPath,
          events,
          "approval",
          "RISK_NOT_APPROVED",
          "Manifest V2 private capabilities must be read-only.",
          manifest,
        );
      }
      if (!options.approvedPermissions?.has(declaration.requiredPermission)) {
        return candidateFailure(
          pluginPath,
          events,
          "approval",
          "PERMISSION_NOT_APPROVED",
          "Capability permission is not present in the deployment approval list.",
          manifest,
        );
      }
      if (declaration.contractSource === manifest.id) {
        if (!declaration.id.startsWith(`${manifest.namespace}.`)) {
          return candidateFailure(
            pluginPath,
            events,
            "approval",
            "CAPABILITY_NAMESPACE_MISMATCH",
            "Private capability does not use the approved plugin namespace.",
            manifest,
          );
        }
        continue;
      }
      const registration = options.catalog.getRegistration(
        declaration.id,
        declaration.contractVersion,
      );
      if (
        !registration ||
        registration.source.id !== declaration.contractSource ||
        registration.contract.requiredPermission !== declaration.requiredPermission ||
        registration.contract.riskLevel !== declaration.riskLevel
      ) {
        return candidateFailure(
          pluginPath,
          events,
          "approval",
          "CONTRACT_SOURCE_MISMATCH",
          "Referenced platform contract does not match the approved catalog source.",
          manifest,
        );
      }
    }
  } else {
    for (const declaration of manifest.capabilities) {
      if (!options.catalog.get(declaration.id, declaration.contractVersion)) {
        return candidateFailure(
          pluginPath,
          events,
          "approval",
          "CONTRACT_UNKNOWN",
          "Plugin declares an unknown capability contract.",
          manifest,
        );
      }
    }
  }

  if (manifest.runtime.type === "http") {
    const artifactHash = await sha256(manifestPath);
    return {
      pluginPath,
      manifest,
      skills: [],
      artifactHash,
      events: [...events, lifecycle("validated", "Manifest and approval policy validated.")],
    };
  }

  if (!manifest.runtime.entry.startsWith("./") || isAbsolute(manifest.runtime.entry)) {
    return candidateFailure(
      pluginPath,
      events,
      "artifact",
      "ENTRY_PATH_INVALID",
      "Local plugin entry must be a relative path inside the plugin root.",
      manifest,
    );
  }

  let approvedRoot: string;
  let entryPath: string;
  try {
    approvedRoot = await realpath(pluginPath);
    const unresolvedEntry = resolve(approvedRoot, manifest.runtime.entry);
    await assertNoSymlinkSegments(approvedRoot, unresolvedEntry);
    entryPath = await realpath(unresolvedEntry);
    if (!isInside(approvedRoot, entryPath) || !(await lstat(entryPath)).isFile()) {
      throw new Error("outside root");
    }
  } catch (error) {
    const symlinkRejected = error instanceof Error && error.message === "symlink";
    return candidateFailure(
      pluginPath,
      events,
      "artifact",
      symlinkRejected ? "ENTRY_SYMLINK_REJECTED" : "ENTRY_PATH_INVALID",
      symlinkRejected
        ? "Symbolic-link plugin entries are not allowed."
        : "Local plugin entry could not be verified inside the plugin root.",
      manifest,
    );
  }

  if (!/[.](?:c|m)?js$/i.test(entryPath)) {
    return candidateFailure(
      pluginPath,
      events,
      "artifact",
      "ENTRY_TYPE_INVALID",
      "Local plugin entry must be a built JavaScript module.",
      manifest,
    );
  }
  const artifactHash = await sha256(entryPath);
  if (manifest.integrity !== undefined && manifest.integrity !== artifactHash) {
    return candidateFailure(
      pluginPath,
      events,
      "artifact",
      "INTEGRITY_MISMATCH",
      "Plugin artifact hash does not match the approved manifest.",
      manifest,
      artifactHash,
    );
  }

  const skills: ValidatedSkillCandidate[] = [];
  if (manifest.manifestVersion === "2") {
    for (const skillDeclaration of manifest.skills ?? []) {
      const sourcePath =
        typeof skillDeclaration === "string" ? skillDeclaration : skillDeclaration.path;
      if (!sourcePath.startsWith("./") || isAbsolute(sourcePath)) {
        return candidateFailure(
          pluginPath,
          events,
          "artifact",
          "SKILL_PATH_INVALID",
          "Plugin Skill path must be relative to the plugin root.",
          manifest,
          artifactHash,
        );
      }
      try {
        const unresolvedSkill = resolve(approvedRoot, sourcePath);
        await assertNoSymlinkSegments(approvedRoot, unresolvedSkill);
        const skillPath = await realpath(unresolvedSkill);
        if (!isInside(approvedRoot, skillPath) || !(await lstat(skillPath)).isDirectory()) {
          throw new Error("outside root");
        }
        const metadata = parseSkillFrontmatter(
          await readFile(resolve(skillPath, "SKILL.md"), "utf8"),
          skillPath.split(/[\\/]/u).at(-1) ?? "",
        );
        if (!metadata) throw new Error("metadata");
        const requiredCapabilities =
          typeof skillDeclaration === "string"
            ? []
            : (skillDeclaration.requiredCapabilities ?? []);
        const requiredToolNames = requiredCapabilities.map((requirement) =>
          capabilityToolName(requirement.id),
        );
        const declaredTools = metadata.allowedTools?.split(/\s+/u).filter(Boolean) ?? [];
        if (
          declaredTools.some((toolName) => !requiredToolNames.includes(toolName)) ||
          new Set(requiredToolNames).size !== requiredToolNames.length
        ) {
          throw new Error("tools");
        }
        for (const requirement of requiredCapabilities) {
          const ownCapability = manifest.capabilities.some(
            (capability) =>
              capability.id === requirement.id &&
              capability.contractVersion === requirement.contractVersion,
          );
          const dependencyKey = `${manifest.id}->${requirement.id}@${requirement.contractVersion}`;
          if (!ownCapability && !options.approvedSkillDependencies?.has(dependencyKey)) {
            throw new Error("dependency");
          }
        }
        skills.push({
          name: metadata.name,
          description: metadata.description,
          sourcePath,
          absolutePath: skillPath,
          artifactHash: await hashAndVerifySkillTree(skillPath),
          requiredCapabilities,
          requiredToolNames,
          requiredConfig:
            typeof skillDeclaration === "string" ? [] : (skillDeclaration.requiredConfig ?? []),
          requiredCredentials:
            typeof skillDeclaration === "string"
              ? []
              : (skillDeclaration.requiredCredentials ?? []),
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "invalid";
        return candidateFailure(
          pluginPath,
          events,
          "artifact",
          code === "metadata" || code === "tools" || code === "dependency"
            ? "SKILL_DECLARATION_INVALID"
            : code === "symlink"
              ? "SKILL_SYMLINK_REJECTED"
              : code === "size"
                ? "SKILL_SIZE_INVALID"
                : "SKILL_PATH_INVALID",
          "Plugin Skill path, metadata, content, or Tool association is invalid.",
          manifest,
          artifactHash,
        );
      }
    }
  }
  return {
    pluginPath,
    manifest,
    entryPath,
    skills,
    artifactHash,
    events: [...events, lifecycle("validated", "Manifest, entry path, and artifact validated.")],
  };
}
