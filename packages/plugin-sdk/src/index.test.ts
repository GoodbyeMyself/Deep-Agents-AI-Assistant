import { qualityTrendV1, type CapabilityProvider } from "@assistant/capability-contracts";
import { describe, expect, it, vi } from "vitest";

import { definePlugin, implementCapability, type PluginHostServices } from "./index.js";

const context = {
  executionContextId: "execution-1",
  contextSnapshotId: "snapshot-1",
  traceId: "trace-1",
  principalId: "user-1",
  permissionScopes: ["data_quality:read"],
};

describe("plugin SDK", () => {
  it("defines a plugin without exposing Deep Agents to the adapter", async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        status: "success" as const,
        data: {
          tableId: "orders",
          metric: "quality_score" as const,
          unit: "percent" as const,
          aggregation: "daily" as const,
          timezone: "Asia/Shanghai",
          points: [{ time: "2026-10-13", value: 96 }],
        },
        evidence: [
          {
            id: "evidence-1",
            source: { type: "table" as const, id: "orders" },
            collectedAt: "2026-10-13T00:00:00+08:00",
            referenceId: "reference-1",
          },
        ],
        warnings: [],
      }),
    );
    const factory = definePlugin(() => ({
      capabilities: [implementCapability({ contract: qualityTrendV1, execute })],
    }));
    const host = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      config: {},
      credentials: { getSecret: vi.fn(() => Promise.resolve("secret")) },
    } satisfies PluginHostServices;

    const plugin = await factory(host);
    const result = await plugin.capabilities[0]?.execute(
      {
        tableId: "orders",
        startTime: "2026-10-07T00:00:00+08:00",
        endTime: "2026-10-13T00:00:00+08:00",
      },
      context,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(result).toEqual(expect.objectContaining({ status: "success" }));
  });

  it("validates standard input before calling an implementation", async () => {
    const execute = vi.fn();
    const implementation = implementCapability({ contract: qualityTrendV1, execute });
    const untypedImplementation: CapabilityProvider = implementation;

    await expect(untypedImplementation.execute({ tableId: "orders" }, context)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
