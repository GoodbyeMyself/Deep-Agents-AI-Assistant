import type { CapabilityCatalog, CapabilityRegistry } from "@assistant/capability-contracts";

import type { PluginRegistry } from "../registry/plugin-registry.js";

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
