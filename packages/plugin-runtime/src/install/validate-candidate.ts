import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { PLUGIN_API_VERSION } from "@assistant/plugin-sdk";

import { lifecycle, failedRecord } from "../lifecycle/record.js";
import type {
  PluginLifecycleEvent,
  PluginRuntimeOptions,
  PluginRuntimeRecord,
} from "../lifecycle/types.js";
import { pluginManifestSchema, type PluginManifest } from "../manifest/schema.js";

export interface ValidatedCandidate {
  readonly pluginPath: string;
  readonly manifest: PluginManifest;
  readonly entryPath?: string;
  readonly artifactHash: string;
  readonly events: readonly PluginLifecycleEvent[];
}

function isInside(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
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
    return failedRecord({
      pluginPath,
      errorCode: "MANIFEST_READ_FAILED",
      events,
      message: "Plugin manifest could not be read as JSON.",
    });
  }

  const parsedManifest = pluginManifestSchema.safeParse(parsedJson);
  if (!parsedManifest.success) {
    return failedRecord({
      pluginPath,
      errorCode: "MANIFEST_INVALID",
      events,
      message: "Plugin manifest does not satisfy protocol version 1.",
    });
  }
  const manifest = parsedManifest.data;
  if (manifest.apiVersion !== PLUGIN_API_VERSION) {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      errorCode: "API_VERSION_UNSUPPORTED",
      events,
      message: "Plugin API version is not supported.",
    });
  }
  if (!options.approvedPluginIds.has(manifest.id)) {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      errorCode: "PLUGIN_NOT_APPROVED",
      events,
      message: "Plugin is not present in the deployment approval list.",
    });
  }
  for (const declaration of manifest.capabilities) {
    if (!options.catalog.get(declaration.id, declaration.contractVersion)) {
      return failedRecord({
        pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        errorCode: "CONTRACT_UNKNOWN",
        events,
        message: "Plugin declares an unknown capability contract.",
      });
    }
  }

  if (manifest.runtime.type === "http") {
    const artifactHash = await sha256(manifestPath);
    return {
      pluginPath,
      manifest,
      artifactHash,
      events: [...events, lifecycle("validated", "Manifest and approval policy validated.")],
    };
  }

  if (!manifest.runtime.entry.startsWith("./") || isAbsolute(manifest.runtime.entry)) {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      errorCode: "ENTRY_PATH_INVALID",
      events,
      message: "Local plugin entry must be a relative path inside the plugin root.",
    });
  }

  let approvedRoot: string;
  let entryPath: string;
  try {
    approvedRoot = await realpath(pluginPath);
    const unresolvedEntry = resolve(approvedRoot, manifest.runtime.entry);
    if ((await lstat(unresolvedEntry)).isSymbolicLink()) {
      return failedRecord({
        pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        errorCode: "ENTRY_SYMLINK_REJECTED",
        events,
        message: "Symbolic-link plugin entries are not allowed.",
      });
    }
    entryPath = await realpath(unresolvedEntry);
    if (!isInside(approvedRoot, entryPath) || !(await lstat(entryPath)).isFile()) {
      throw new Error("outside root");
    }
  } catch {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      errorCode: "ENTRY_PATH_INVALID",
      events,
      message: "Local plugin entry could not be verified inside the plugin root.",
    });
  }

  if (!/[.](?:c|m)?js$/i.test(entryPath)) {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      errorCode: "ENTRY_TYPE_INVALID",
      events,
      message: "Local plugin entry must be a built JavaScript module.",
    });
  }
  const artifactHash = await sha256(entryPath);
  if (manifest.integrity !== undefined && manifest.integrity !== artifactHash) {
    return failedRecord({
      pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      artifactHash,
      errorCode: "INTEGRITY_MISMATCH",
      events,
      message: "Plugin artifact hash does not match the approved manifest.",
    });
  }
  return {
    pluginPath,
    manifest,
    entryPath,
    artifactHash,
    events: [...events, lifecycle("validated", "Manifest, entry path, and artifact validated.")],
  };
}
