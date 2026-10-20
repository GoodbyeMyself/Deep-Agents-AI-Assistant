import { pathToFileURL } from "node:url";

import type {
  CapabilityBinding,
  CapabilityBindingLease,
  CapabilityContract,
  CapabilityProvider,
  CapabilityRegistrationLease,
} from "@assistant/capability-contracts";
import type { AssistantPlugin, PluginFactory } from "@assistant/plugin-sdk";

import { HttpCapabilityDriver, HttpCapabilityProvider } from "../driver/http-capability.js";
import { discoverPluginPaths } from "../install/discover.js";
import {
  capabilitySetsMatch,
  inspectV2Contracts,
  isAssistantPlugin,
} from "../install/plugin-shape.js";
import {
  capabilityDiagnostics,
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
    let dynamicContracts: readonly CapabilityContract[] = [];
    try {
      if (manifest.runtime.type === "local") {
        const imported = (await import(pathToFileURL(candidate.entryPath!).href)) as {
          default?: unknown;
        };
        if (typeof imported.default !== "function") throw new Error("factory missing");
        const factory = imported.default as PluginFactory;
        plugin = await factory(createPluginHostServices(manifest.id, this.#options));
        if (!isAssistantPlugin(plugin)) throw new Error("plugin shape invalid");
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
      return this.#failed(candidate, "load", "PLUGIN_LOAD_FAILED", "Plugin module failed to load.");
    }

    const inspectedEvents = [
      ...candidate.events,
      lifecycle("validated", "Plugin runtime exports loaded for inspection."),
    ];
    if (!capabilitySetsMatch(manifest, providers)) {
      await this.#dispose(plugin);
      return this.#failed(
        candidate,
        "inspect",
        "CAPABILITY_DECLARATION_MISMATCH",
        "Manifest capability declarations do not match plugin implementations.",
        inspectedEvents,
      );
    }
    if (manifest.manifestVersion === "2") {
      if (!plugin) {
        return this.#failed(
          candidate,
          "inspect",
          "V2_LOCAL_PLUGIN_REQUIRED",
          "Manifest V2 requires a trusted local plugin module.",
          inspectedEvents,
        );
      }
      try {
        dynamicContracts = inspectV2Contracts(manifest, plugin, this.#options.catalog).dynamicContracts;
      } catch {
        await this.#dispose(plugin);
        return this.#failed(
          candidate,
          "inspect",
          "CONTRACT_DECLARATION_MISMATCH",
          "Manifest contract declarations do not match plugin exports or catalog sources.",
          inspectedEvents,
        );
      }
    }

    const bindings: CapabilityBinding[] = providers.map((provider) => ({
      capabilityId: provider.id,
      contractVersion: provider.contractVersion,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      driver: manifest.runtime.type,
      provider,
    }));
    let contractLease: CapabilityRegistrationLease = { rollback: () => undefined };
    try {
      if (dynamicContracts.length > 0 && manifest.manifestVersion === "2") {
        contractLease = this.#options.catalog.registerMany(dynamicContracts, {
          type: "plugin",
          id: manifest.id,
          namespace: manifest.namespace,
        });
      }
    } catch {
      await this.#dispose(plugin);
      return this.#failed(
        candidate,
        "register",
        "CAPABILITY_CONTRACT_CONFLICT",
        "A dynamic capability contract could not be registered.",
        inspectedEvents,
      );
    }
    let bindingLease: CapabilityBindingLease;
    try {
      bindingLease = this.#options.capabilityRegistry.registerMany(bindings);
    } catch {
      contractLease.rollback();
      await this.#dispose(plugin);
      return this.#failed(
        candidate,
        "register",
        "CAPABILITY_PROVIDER_CONFLICT",
        "A capability provider is already registered for this contract.",
        inspectedEvents,
      );
    }

    try {
      await plugin?.initialize?.();
    } catch {
      bindingLease.rollback();
      contractLease.rollback();
      await this.#dispose(plugin);
      return this.#failed(
        candidate,
        "initialize",
        "PLUGIN_INITIALIZE_FAILED",
        "Plugin initialization failed; staged registrations were rolled back.",
        inspectedEvents,
      );
    }
    const initializedEvents = [
      ...inspectedEvents,
      lifecycle("initialized", "Plugin initialized with staged registrations."),
    ];

    let health;
    try {
      health = await plugin?.healthCheck?.();
    } catch {
      bindingLease.rollback();
      contractLease.rollback();
      await this.#dispose(plugin);
      return this.#failed(
        candidate,
        "health",
        "PLUGIN_HEALTH_FAILED",
        "Plugin health check failed; staged registrations were rolled back.",
        initializedEvents,
      );
    }
    if (health && !health.ok) {
      bindingLease.rollback();
      contractLease.rollback();
      await this.#dispose(plugin);
      return {
        ...this.#metadata(candidate),
        status: "degraded",
        failureStage: "health",
        events: [...initializedEvents, lifecycle("degraded", "Plugin health check failed.")],
      };
    }
    return {
      ...this.#metadata(candidate),
      status: "ready",
      events: [...initializedEvents, lifecycle("ready", "Capabilities verified and registered.")],
    };
  }

  #metadata(candidate: ValidatedCandidate) {
    const { manifest } = candidate;
    return {
      pluginPath: candidate.pluginPath,
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      artifactHash: candidate.artifactHash,
      manifestVersion: manifest.manifestVersion,
      capabilities: capabilityDiagnostics(manifest),
      ...(manifest.manifestVersion === "2"
        ? { namespace: manifest.namespace, skillPaths: manifest.skills ?? [] }
        : {}),
    } as const;
  }

  #failed(
    candidate: ValidatedCandidate,
    failureStage: NonNullable<PluginRuntimeRecord["failureStage"]>,
    errorCode: string,
    message: string,
    events = candidate.events,
  ): PluginRuntimeRecord {
    return failedRecord({
      ...this.#metadata(candidate),
      failureStage,
      errorCode,
      events,
      message,
    });
  }

  async #dispose(plugin: AssistantPlugin | undefined): Promise<void> {
    try {
      await plugin?.dispose?.();
    } catch {
      // Disposal is best-effort after the registries have already failed closed.
    }
  }
}
