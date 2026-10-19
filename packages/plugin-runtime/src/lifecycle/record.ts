import type { PluginLifecycleEvent, PluginLifecycleStatus, PluginRuntimeRecord } from "./types.js";

export function lifecycle(status: PluginLifecycleStatus, message: string): PluginLifecycleEvent {
  return { status, message };
}

export function failedRecord(options: {
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
