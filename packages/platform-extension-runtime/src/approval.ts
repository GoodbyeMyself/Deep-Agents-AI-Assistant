import {
  createPlatformExtensionManifestDigest,
  parsePlatformExtensionDefinition,
} from "./manifest.js";
import type { PlatformExtensionApproval, PlatformExtensionSnapshot } from "./types.js";

export function createApprovedPlatformExtensionSnapshot(
  candidates: readonly unknown[],
  approvals: readonly PlatformExtensionApproval[],
): PlatformExtensionSnapshot {
  const approvalById = new Map<string, PlatformExtensionApproval>();
  for (const approval of approvals) {
    if (approvalById.has(approval.id)) {
      throw new Error(`Duplicate Platform Extension approval '${approval.id}'.`);
    }
    approvalById.set(approval.id, approval);
  }

  const approved = candidates.map((candidate) => {
    const definition = parsePlatformExtensionDefinition(candidate);
    const approval = approvalById.get(definition.manifest.id);
    if (approval === undefined) {
      throw new Error(`Platform Extension '${definition.manifest.id}' is not approved.`);
    }
    const manifestDigest = createPlatformExtensionManifestDigest(definition.manifest);
    if (
      approval.version !== definition.manifest.version ||
      approval.manifestDigest !== manifestDigest
    ) {
      throw new Error(`Platform Extension approval drift for '${definition.manifest.id}'.`);
    }
    approvalById.delete(definition.manifest.id);
    return Object.freeze({ definition, manifestDigest });
  });

  if (approvalById.size > 0) {
    throw new Error(
      `Approved Platform Extension is missing: '${approvalById.keys().next().value}'.`,
    );
  }
  return Object.freeze({ approved: Object.freeze(approved) });
}
