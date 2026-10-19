import { pathToFileURL } from "node:url";

import type { CapabilityBinding, CapabilityProvider } from "@assistant/capability-contracts";
import type { AssistantPlugin, PluginFactory } from "@assistant/plugin-sdk";

import { HttpCapabilityDriver, HttpCapabilityProvider } from "../driver/http-capability.js";
import { discoverPluginPaths } from "../install/discover.js";
import { capabilitySetsMatch, isAssistantPlugin } from "../install/plugin-shape.js";
import {
  validateCandidate,
  type ValidatedCandidate,
} from "../install/validate-candidate.js";
import { failedRecord, lifecycle } from "../lifecycle/record.js";
import type { PluginRuntimeOptions, PluginRuntimeRecord } from "../lifecycle/types.js";
import { PluginRegistry } from "../registry/plugin-registry.js";
import { createPluginHostServices } from "./host-services.js";

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
        plugin = await factory(createPluginHostServices(manifest.id, this.#options));
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
}
