import { describe, expect, it } from "vitest";

import { enterpriseCapabilityPolicy } from "./index.js";

const context = {
  executionContextId: "execution",
  contextSnapshotId: "snapshot",
  traceId: "trace",
  principalId: "user",
  contextObjectId: "orders",
  authorizedObjectIds: ["orders"],
  permissionScopes: ["data_quality:read"],
};

describe("enterprise capability policy", () => {
  it("requires both capability scope and current object scope", async () => {
    const base = {
      capabilityId: "data_quality.get_trend",
      contractVersion: "1.0.0",
      requiredPermission: "data_quality:read",
      context,
    };
    await expect(
      enterpriseCapabilityPolicy.authorize({ ...base, input: { tableId: "orders" } }),
    ).resolves.toBe(true);
    await expect(
      enterpriseCapabilityPolicy.authorize({ ...base, input: { tableId: "customers" } }),
    ).resolves.toBe(false);
  });
});
