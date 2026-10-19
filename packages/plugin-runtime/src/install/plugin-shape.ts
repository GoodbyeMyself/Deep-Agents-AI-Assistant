import { capabilityKey, type CapabilityProvider } from "@assistant/capability-contracts";
import type { AssistantPlugin } from "@assistant/plugin-sdk";

import type { PluginManifest } from "../manifest/schema.js";

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
