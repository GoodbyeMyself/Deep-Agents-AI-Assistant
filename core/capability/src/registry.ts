import { capabilityKey } from "./contracts.js";

export interface CapabilityExecutionContext {
  readonly executionContextId: string;
  readonly contextSnapshotId: string;
  readonly traceId: string;
  readonly principalId: string;
  readonly tenantId?: string;
  readonly sessionId?: string;
  readonly runId?: string;
  readonly authorizationRef?: string;
  readonly contextObjectId?: string;
  readonly authorizedObjectIds?: readonly string[];
  readonly permissionScopes: readonly string[];
}

export interface CapabilityProvider {
  readonly id: string;
  readonly contractVersion: string;
  execute(input: unknown, context: CapabilityExecutionContext): Promise<unknown>;
}

export interface CapabilityBinding {
  readonly capabilityId: string;
  readonly contractVersion: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly driver: "local" | "http";
  readonly provider: CapabilityProvider;
}

export class CapabilityRegistry {
  readonly #bindings = new Map<string, CapabilityBinding>();

  registerMany(bindings: readonly CapabilityBinding[]): void {
    const incoming = new Set<string>();
    for (const binding of bindings) {
      const key = capabilityKey(binding.capabilityId, binding.contractVersion);
      if (incoming.has(key) || this.#bindings.has(key)) {
        throw new Error(`Capability provider conflict for '${key}'.`);
      }
      incoming.add(key);
    }
    for (const binding of bindings) {
      this.#bindings.set(capabilityKey(binding.capabilityId, binding.contractVersion), binding);
    }
  }

  resolve(id: string, version: string): CapabilityBinding | undefined {
    return this.#bindings.get(capabilityKey(id, version));
  }

  list(): readonly CapabilityBinding[] {
    return [...this.#bindings.values()];
  }
}
