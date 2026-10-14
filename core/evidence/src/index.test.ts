import { describe, expect, it } from "vitest";

import { resolveEvidence } from "./index.js";

describe("evidence resolver", () => {
  it("returns safe evidence metadata without ownership internals", () => {
    const resolved = resolveEvidence({
      referenceId: "reference-1",
      ownerId: "owner",
      tenantId: "tenant",
      runId: "5fc84f00-0ba1-4c0f-86d2-c630fe24492f",
      objectId: "orders",
      createdAt: "2026-10-14T00:00:00Z",
      evidence: {
        id: "evidence-1",
        source: { type: "table", id: "orders" },
        collectedAt: "2026-10-14T00:00:00Z",
        referenceId: "reference-1",
      },
    });
    expect(resolved.referenceId).toBe("reference-1");
    expect(resolved).not.toHaveProperty("ownerId");
    expect(resolved).not.toHaveProperty("tenantId");
  });
});
