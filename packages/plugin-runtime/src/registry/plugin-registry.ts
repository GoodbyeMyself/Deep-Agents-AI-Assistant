import type { PluginRuntimeRecord } from "../lifecycle/types.js";

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
