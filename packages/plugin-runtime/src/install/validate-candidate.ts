import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

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
  readonly skillPaths: readonly string[];
  readonly artifactHash: string;
  readonly events: readonly PluginLifecycleEvent[];
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
            ? { namespace: manifest.namespace, skillPaths: manifest.skills ?? [] }
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
      skillPaths: [],
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

  const skillPaths: string[] = [];
  if (manifest.manifestVersion === "2") {
    for (const skillDeclaration of manifest.skills ?? []) {
      if (!skillDeclaration.startsWith("./") || isAbsolute(skillDeclaration)) {
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
        const unresolvedSkill = resolve(approvedRoot, skillDeclaration);
        await assertNoSymlinkSegments(approvedRoot, unresolvedSkill);
        const skillPath = await realpath(unresolvedSkill);
        if (!isInside(approvedRoot, skillPath) || !(await lstat(skillPath)).isDirectory()) {
          throw new Error("outside root");
        }
        skillPaths.push(skillPath);
      } catch {
        return candidateFailure(
          pluginPath,
          events,
          "artifact",
          "SKILL_PATH_INVALID",
          "Plugin Skill path could not be verified inside the plugin root.",
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
    skillPaths,
    artifactHash,
    events: [...events, lifecycle("validated", "Manifest, entry path, and artifact validated.")],
  };
}
