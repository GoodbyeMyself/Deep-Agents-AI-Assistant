import type { CapabilityCatalog, CapabilityRegistry } from "@assistant/capability-core";

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

export type PluginFailureStage =
  | "manifest"
  | "approval"
  | "artifact"
  | "load"
  | "inspect"
  | "register"
  | "initialize"
  | "health";

export interface PluginCapabilityDiagnostic {
  readonly id: string;
  readonly contractVersion: string;
  readonly contractSource?: string;
  readonly requiredPermission?: string;
  readonly riskLevel?: "read" | "write" | "high";
}

export interface SkillCapabilityRequirement {
  readonly id: string;
  readonly contractVersion: string;
}

export type PluginSkillStatus = "available" | "excluded";

export interface VerifiedPluginSkill {
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly absolutePath: string;
  readonly artifactHash: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly requiredCapabilities: readonly SkillCapabilityRequirement[];
  readonly requiredToolNames: readonly string[];
  readonly requiredConfig: readonly string[];
  readonly requiredCredentials: readonly string[];
  readonly status: PluginSkillStatus;
  readonly exclusionReason?:
    | "TOOL_UNAVAILABLE"
    | "CONFIG_UNAVAILABLE"
    | "CREDENTIAL_UNAVAILABLE"
    | "NAME_CONFLICT"
    | "PLUGIN_UNAVAILABLE";
  readonly overridePolicy: "deny";
}

export interface PluginRuntimeRecord {
  readonly pluginPath: string;
  readonly pluginId?: string;
  readonly pluginVersion?: string;
  readonly artifactHash?: string;
  readonly manifestVersion?: "1" | "2";
  readonly namespace?: string;
  readonly capabilities?: readonly PluginCapabilityDiagnostic[];
  readonly skillPaths?: readonly string[];
  readonly skills?: readonly VerifiedPluginSkill[];
  readonly failureStage?: PluginFailureStage;
  readonly status: PluginLifecycleStatus;
  readonly errorCode?: string;
  readonly events: readonly PluginLifecycleEvent[];
}

export interface PluginRuntimeOptions {
  readonly installDir: string;
  readonly approvedPluginIds: ReadonlySet<string>;
  readonly approvedNamespaces?: ReadonlySet<string>;
  readonly approvedPermissions?: ReadonlySet<string>;
  readonly catalog: CapabilityCatalog;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly pluginRegistry?: PluginRegistry;
  readonly allowedHttpOrigins?: ReadonlySet<string>;
  readonly pluginConfigs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly getSecret?: (pluginId: string, reference: string) => Promise<string>;
  readonly hasCredential?: (pluginId: string, reference: string) => Promise<boolean>;
  readonly approvedSkillDependencies?: ReadonlySet<string>;
}
