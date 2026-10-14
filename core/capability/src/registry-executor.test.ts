import { describe, expect, it, vi } from "vitest";

import { createStandardCapabilityCatalog } from "./catalog.js";
import { qualityTrendResultSchema } from "./contracts.js";
import { CapabilityExecutor, type CapabilityAuditSink } from "./executor.js";
import { CapabilityRegistry, type CapabilityProvider } from "./registry.js";

const context = {
  executionContextId: "execution-1",
  contextSnapshotId: "snapshot-1",
  traceId: "trace-1",
  principalId: "user-1",
  permissionScopes: ["data_quality:read"],
};

function qualityProvider(execute?: CapabilityProvider["execute"]): CapabilityProvider {
  return {
    id: "data_quality.get_trend",
    contractVersion: "1.0.0",
    execute:
      execute ??
      ((input) =>
        Promise.resolve({
          status: "success",
          data: {
            tableId: (input as { tableId: string }).tableId,
            metric: "quality_score",
            unit: "percent",
            aggregation: "daily",
            timezone: "Asia/Shanghai",
            points: [{ time: "2026-10-14", value: 96 }],
          },
          evidence: [
            {
              id: "evidence-1",
              source: { type: "table", id: "orders" },
              collectedAt: "2026-10-14T00:00:00+08:00",
              referenceId: "reference-1",
            },
          ],
          warnings: [],
        })),
  };
}

function binding(provider = qualityProvider()) {
  return {
    capabilityId: provider.id,
    contractVersion: provider.contractVersion,
    pluginId: "demo-product-a",
    pluginVersion: "1.0.0",
    driver: "local" as const,
    provider,
  };
}

const input = {
  tableId: "orders",
  startTime: "2026-10-14T00:00:00+08:00",
  endTime: "2026-10-14T23:59:59+08:00",
};

describe("capability registry and executor", () => {
  it("rejects duplicate providers without replacing the first binding", () => {
    const registry = new CapabilityRegistry();
    registry.registerMany([binding()]);

    expect(() => registry.registerMany([binding()])).toThrow("provider conflict");
    expect(registry.resolve("data_quality.get_trend", "1.0.0")?.pluginId).toBe("demo-product-a");
  });

  it("denies execution without the required permission before calling the provider", async () => {
    const execute = vi.fn<CapabilityProvider["execute"]>();
    const registry = new CapabilityRegistry();
    registry.registerMany([binding(qualityProvider(execute))]);
    const audit = { write: vi.fn<CapabilityAuditSink["write"]>(() => Promise.resolve()) };
    const executor = new CapabilityExecutor({
      catalog: createStandardCapabilityCatalog(),
      registry,
      audit,
    });

    const result = await executor.execute("data_quality.get_trend", "1.0.0", input, {
      ...context,
      permissionScopes: [],
    });

    expect(qualityTrendResultSchema.parse(result).error?.code).toBe("FORBIDDEN");
    expect(execute).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });

  it("rejects invalid input before calling the provider", async () => {
    const execute = vi.fn<CapabilityProvider["execute"]>();
    const registry = new CapabilityRegistry();
    registry.registerMany([binding(qualityProvider(execute))]);
    const executor = new CapabilityExecutor({
      catalog: createStandardCapabilityCatalog(),
      registry,
    });

    const result = await executor.execute(
      "data_quality.get_trend",
      "1.0.0",
      { ...input, endTime: "not-a-date" },
      context,
    );

    expect(qualityTrendResultSchema.parse(result).error?.code).toBe("INVALID_INPUT");
    expect(execute).not.toHaveBeenCalled();
  });

  it("converts invalid provider output to SCHEMA_MISMATCH", async () => {
    const registry = new CapabilityRegistry();
    registry.registerMany([
      binding(
        qualityProvider(() => Promise.resolve({ status: "success", data: { secret: true } })),
      ),
    ]);
    const executor = new CapabilityExecutor({
      catalog: createStandardCapabilityCatalog(),
      registry,
    });

    const result = await executor.execute("data_quality.get_trend", "1.0.0", input, context);

    expect(qualityTrendResultSchema.parse(result).error?.code).toBe("SCHEMA_MISMATCH");
  });

  it("returns PROVIDER_UNAVAILABLE for a catalog capability that is not installed", async () => {
    const executor = new CapabilityExecutor({
      catalog: createStandardCapabilityCatalog(),
      registry: new CapabilityRegistry(),
    });

    const result = await executor.execute("data_quality.get_trend", "1.0.0", input, context);

    expect(qualityTrendResultSchema.parse(result).error?.code).toBe("PROVIDER_UNAVAILABLE");
  });
});
