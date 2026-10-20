import type {
  PluginCapabilityDiagnostic,
  PluginFailureStage,
  PluginLifecycleEvent,
  PluginLifecycleStatus,
  PluginRuntimeRecord,
  VerifiedPluginSkill,
} from "./types.js";

export function lifecycle(status: PluginLifecycleStatus, message: string): PluginLifecycleEvent {
  return { status, message };
}

export function failedRecord(options: {
  pluginPath: string;
  pluginId?: string;
  pluginVersion?: string;
  artifactHash?: string;
  manifestVersion?: "1" | "2";
  namespace?: string;
  capabilities?: readonly PluginCapabilityDiagnostic[];
  skillPaths?: readonly string[];
  skills?: readonly VerifiedPluginSkill[];
  failureStage?: PluginFailureStage;
  errorCode: string;
  events: readonly PluginLifecycleEvent[];
  message: string;
}): PluginRuntimeRecord {
  return {
    pluginPath: options.pluginPath,
    ...(options.pluginId === undefined ? {} : { pluginId: options.pluginId }),
    ...(options.pluginVersion === undefined ? {} : { pluginVersion: options.pluginVersion }),
    ...(options.artifactHash === undefined ? {} : { artifactHash: options.artifactHash }),
    ...(options.manifestVersion === undefined
      ? {}
      : { manifestVersion: options.manifestVersion }),
    ...(options.namespace === undefined ? {} : { namespace: options.namespace }),
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    ...(options.skillPaths === undefined ? {} : { skillPaths: options.skillPaths }),
    ...(options.skills === undefined ? {} : { skills: options.skills }),
    ...(options.failureStage === undefined ? {} : { failureStage: options.failureStage }),
    status: "failed",
    errorCode: options.errorCode,
    events: [...options.events, lifecycle("failed", options.message)],
  };
}
