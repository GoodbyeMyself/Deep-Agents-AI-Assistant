import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  capabilityKey,
  type CapabilityBinding,
  type CapabilityCatalog,
  type CapabilityProvider,
  type CapabilityRegistry,
} from "@assistant/capability-contracts";
import {
  PLUGIN_API_VERSION,
  type AssistantPlugin,
  type PluginFactory,
  type PluginHostServices,
} from "@assistant/plugin-sdk";

import { HttpCapabilityDriver, HttpCapabilityProvider } from "./http-driver.js";
import { pluginManifestSchema, type PluginManifest } from "./manifest.js";

export type PluginLifecycleStatus =
  | "discovered"
  | "validated"
  | "initialized"
  | "ready"
  | "degraded"
  | "failed";

export interface PluginLifecycleEvent {
  readonly status: PluginLifecycleStatus;
  readonly message: string;
}

export interface PluginRuntimeRecord {
  readonly pluginPath: string;
  readonly pluginId?: string;
  readonly pluginVersion?: string;
  readonly artifactHash?: string;
  readonly status: PluginLifecycleStatus;
  readonly errorCode?: string;
  readonly events: readonly PluginLifecycleEvent[];
}

interface ValidatedCandidate {
  readonly pluginPath: string;
  readonly manifest: PluginManifest;
  readonly entryPath?: string;
  readonly artifactHash: string;
  readonly events: readonly PluginLifecycleEvent[];
}

export class PluginRegistry {
  readonly #records = new Map<string, PluginRuntimeRecord>();

  set(record: PluginRuntimeRecord): void {
    if (record.pluginId) this.#records.set(record.pluginId, record);
  }

  get(pluginId: string): PluginRuntimeRecord | undefined {
    return this.#records.get(pluginId);
  }

  list(): readonly PluginRuntimeRecord[] {
    return [...this.#records.values()];
  }
}

export interface PluginRuntimeOptions {
  readonly installDir: string;
  readonly approvedPluginIds: ReadonlySet<string>;
  readonly catalog: CapabilityCatalog;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly pluginRegistry?: PluginRegistry;
  readonly allowedHttpOrigins?: ReadonlySet<string>;
  readonly pluginConfigs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly getSecret?: (pluginId: string, reference: string) => Promise<string>;
}

function lifecycle(status: PluginLifecycleStatus, message: string): PluginLifecycleEvent {
  return { status, message };
}

function failedRecord(options: {
  pluginPath: string;
  pluginId?: string;
  pluginVersion?: string;
  artifactHash?: string;
  errorCode: string;
  events: readonly PluginLifecycleEvent[];
  message: string;
}): PluginRuntimeRecord {
  return {
    pluginPath: options.pluginPath,
    ...(options.pluginId === undefined ? {} : { pluginId: options.pluginId }),
    ...(options.pluginVersion === undefined ? {} : { pluginVersion: options.pluginVersion }),
    ...(options.artifactHash === undefined ? {} : { artifactHash: options.artifactHash }),
    status: "failed",
    errorCode: options.errorCode,
    events: [...options.events, lifecycle("failed", options.message)],
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

async function discoverPluginPaths(installDir: string): Promise<string[]> {
  const approvedRoot = await realpath(installDir);
  if (await fileExists(resolve(approvedRoot, "plugin.json"))) return [approvedRoot];
  const entries = await readdir(approvedRoot, { withFileTypes: true });
  const pluginPaths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = resolve(approvedRoot, entry.name);
    if (await fileExists(resolve(candidate, "plugin.json"))) pluginPaths.push(candidate);
  }
  return pluginPaths.sort();
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

async function validateCandidate(
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

function capabilitySetsMatch(
  manifest: PluginManifest,
  providers: readonly CapabilityProvider[],
): boolean {
  const declared = manifest.capabilities
    .map((item) => capabilityKey(item.id, item.contractVersion))
    .sort();
  const implemented = providers.map((item) => capabilityKey(item.id, item.contractVersion)).sort();
  return (
    declared.length === implemented.length &&
    declared.every((item, index) => item === implemented[index])
  );
}

function isAssistantPlugin(value: unknown): value is AssistantPlugin {
  if (value === null || typeof value !== "object") return false;
  const capabilities = (value as { capabilities?: unknown }).capabilities;
  return Array.isArray(capabilities);
}

export class PluginRuntime {
  readonly #options: PluginRuntimeOptions;
  readonly pluginRegistry: PluginRegistry;

  constructor(options: PluginRuntimeOptions) {
    this.#options = options;
    this.pluginRegistry = options.pluginRegistry ?? new PluginRegistry();
  }

  async start(): Promise<readonly PluginRuntimeRecord[]> {
    const pluginPaths = await discoverPluginPaths(this.#options.installDir);
    const candidates = await Promise.all(
      pluginPaths.map((pluginPath) => validateCandidate(pluginPath, this.#options)),
    );
    const duplicateIds = new Set<string>();
    const seenIds = new Set<string>();
    for (const candidate of candidates) {
      const pluginId = "manifest" in candidate ? candidate.manifest.id : candidate.pluginId;
      if (!pluginId) continue;
      if (seenIds.has(pluginId)) duplicateIds.add(pluginId);
      seenIds.add(pluginId);
    }

    const records: PluginRuntimeRecord[] = [];
    for (const candidate of candidates) {
      if (!("manifest" in candidate)) {
        records.push(candidate);
        this.pluginRegistry.set(candidate);
        continue;
      }
      if (duplicateIds.has(candidate.manifest.id)) {
        const record = failedRecord({
          pluginPath: candidate.pluginPath,
          pluginId: candidate.manifest.id,
          pluginVersion: candidate.manifest.version,
          artifactHash: candidate.artifactHash,
          errorCode: "PLUGIN_ID_DUPLICATE",
          events: candidate.events,
          message: "Plugin ID is duplicated in the installation directory.",
        });
        records.push(record);
        this.pluginRegistry.set(record);
        continue;
      }
      const record = await this.#loadCandidate(candidate);
      records.push(record);
      this.pluginRegistry.set(record);
    }
    return records;
  }

  async #loadCandidate(candidate: ValidatedCandidate): Promise<PluginRuntimeRecord> {
    const { manifest } = candidate;
    let plugin: AssistantPlugin | undefined;
    let providers: readonly CapabilityProvider[];
    try {
      if (manifest.runtime.type === "local") {
        const imported = (await import(pathToFileURL(candidate.entryPath!).href)) as {
          default?: unknown;
        };
        if (typeof imported.default !== "function") throw new Error("factory missing");
        const factory = imported.default as PluginFactory;
        plugin = await factory(this.#createHostServices(manifest.id));
        if (!isAssistantPlugin(plugin)) throw new Error("plugin shape invalid");
        await plugin.initialize?.();
        providers = plugin.capabilities;
      } else {
        const driver = new HttpCapabilityDriver({
          baseUrl: manifest.runtime.baseUrl,
          allowedOrigins: this.#options.allowedHttpOrigins ?? new Set(),
        });
        providers = manifest.capabilities.map(
          (declaration) =>
            new HttpCapabilityProvider({
              id: declaration.id,
              contractVersion: declaration.contractVersion,
              driver,
            }),
        );
      }
    } catch {
      return failedRecord({
        pluginPath: candidate.pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        artifactHash: candidate.artifactHash,
        errorCode: "PLUGIN_LOAD_FAILED",
        events: candidate.events,
        message: "Plugin module failed to load or initialize.",
      });
    }

    const initializedEvents = [
      ...candidate.events,
      lifecycle("initialized", "Plugin initialized without exposing capabilities."),
    ];
    if (!capabilitySetsMatch(manifest, providers)) {
      await plugin?.dispose?.();
      return failedRecord({
        pluginPath: candidate.pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        artifactHash: candidate.artifactHash,
        errorCode: "CAPABILITY_DECLARATION_MISMATCH",
        events: initializedEvents,
        message: "Manifest capability declarations do not match plugin implementations.",
      });
    }

    const health = await plugin?.healthCheck?.();
    if (health && !health.ok) {
      await plugin?.dispose?.();
      return {
        pluginPath: candidate.pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        artifactHash: candidate.artifactHash,
        status: "degraded",
        events: [...initializedEvents, lifecycle("degraded", "Plugin health check failed.")],
      };
    }

    const bindings: CapabilityBinding[] = providers.map((provider) => ({
      capabilityId: provider.id,
      contractVersion: provider.contractVersion,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      driver: manifest.runtime.type,
      provider,
    }));
    try {
      this.#options.capabilityRegistry.registerMany(bindings);
    } catch {
      await plugin?.dispose?.();
      return failedRecord({
        pluginPath: candidate.pluginPath,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        artifactHash: candidate.artifactHash,
        errorCode: "CAPABILITY_PROVIDER_CONFLICT",
        events: initializedEvents,
        message: "A capability provider is already registered for this contract.",
      });
    }
    return {
      pluginPath: candidate.pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      artifactHash: candidate.artifactHash,
      status: "ready",
      events: [...initializedEvents, lifecycle("ready", "Capabilities verified and registered.")],
    };
  }

  #createHostServices(pluginId: string): PluginHostServices {
    const records: Array<{ level: "info" | "warn" | "error"; message: string }> = [];
    const add = (level: "info" | "warn" | "error", message: string) => {
      records.push({ level, message: message.slice(0, 500) });
    };
    return {
      logger: {
        info: (message) => add("info", message),
        warn: (message) => add("warn", message),
        error: (message) => add("error", message),
      },
      config: this.#options.pluginConfigs?.[pluginId] ?? {},
      credentials: {
        getSecret: (reference) => {
          if (!this.#options.getSecret) {
            return Promise.reject(new Error("No credential provider is configured."));
          }
          return this.#options.getSecret(pluginId, reference);
        },
      },
    };
  }
}
