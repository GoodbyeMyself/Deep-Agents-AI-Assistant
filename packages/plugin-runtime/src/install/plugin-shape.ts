import {
  capabilityKey,
  type CapabilityCatalog,
  type CapabilityContract,
  type CapabilityProvider,
} from "@assistant/capability-core";
import type { AssistantPlugin } from "@assistant/plugin-sdk";

import type { PluginManifest, PluginManifestV2 } from "../manifest/schema.js";

export function capabilitySetsMatch(
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

export function isAssistantPlugin(value: unknown): value is AssistantPlugin {
  if (value === null || typeof value !== "object") return false;
  const capabilities = (value as { capabilities?: unknown }).capabilities;
  return Array.isArray(capabilities);
}

export interface V2ContractInspection {
  readonly dynamicContracts: readonly CapabilityContract[];
}

export function inspectV2Contracts(
  manifest: PluginManifestV2,
  plugin: AssistantPlugin,
  catalog: CapabilityCatalog,
): V2ContractInspection {
  const exportedContracts = plugin.contracts ?? [];
  const exportedByKey = new Map<string, CapabilityContract>();
  for (const contract of exportedContracts) {
    const key = capabilityKey(contract.id, contract.version);
    if (exportedByKey.has(key)) throw new Error("duplicate exported contract");
    exportedByKey.set(key, contract);
  }

  const dynamicContracts: CapabilityContract[] = [];
  for (const declaration of manifest.capabilities) {
    const key = capabilityKey(declaration.id, declaration.contractVersion);
    if (declaration.contractSource === manifest.id) {
      const contract = exportedByKey.get(key);
      if (
        !contract ||
        contract.requiredPermission !== declaration.requiredPermission ||
        contract.riskLevel !== declaration.riskLevel
      ) {
        throw new Error("dynamic contract declaration mismatch");
      }
      dynamicContracts.push(contract);
      exportedByKey.delete(key);
      continue;
    }

    const registration = catalog.getRegistration(
      declaration.id,
      declaration.contractVersion,
    );
    if (
      !registration ||
      registration.source.id !== declaration.contractSource ||
      registration.contract.requiredPermission !== declaration.requiredPermission ||
      registration.contract.riskLevel !== declaration.riskLevel
    ) {
      throw new Error("platform contract declaration mismatch");
    }
  }
  if (exportedByKey.size > 0) throw new Error("undeclared exported contract");
  return { dynamicContracts };
}
