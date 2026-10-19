import type { PluginHostServices } from "@assistant/plugin-sdk";

import type { PluginRuntimeOptions } from "../lifecycle/types.js";

export function createPluginHostServices(
  pluginId: string,
  options: Pick<PluginRuntimeOptions, "pluginConfigs" | "getSecret">,
): PluginHostServices {
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
    config: options.pluginConfigs?.[pluginId] ?? {},
    credentials: {
      getSecret: (reference) => {
        if (!options.getSecret) {
          return Promise.reject(new Error("No credential provider is configured."));
        }
        return options.getSecret(pluginId, reference);
      },
    },
  };
}
