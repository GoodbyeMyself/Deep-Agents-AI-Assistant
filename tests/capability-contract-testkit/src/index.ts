import {
  dataMapSearchObjectsResultSchema,
  qualityTrendResultSchema,
} from "@assistant/capability-contracts";
import type { PluginFactory, PluginHostServices } from "@assistant/plugin-sdk";
import { describe, expect, it, vi } from "vitest";

const context = {
  executionContextId: "contract-execution",
  contextSnapshotId: "contract-snapshot",
  traceId: "contract-trace",
  principalId: "contract-user",
  tenantId: "contract-tenant",
  authorizationRef: "mock-auth:contract-user",
  contextObjectId: "orders",
  authorizedObjectIds: ["orders"],
  permissionScopes: ["data_map:read", "data_quality:read"],
};

function hostServices(): PluginHostServices {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    config: {},
    credentials: { getSecret: vi.fn(() => Promise.reject(new Error("not configured"))) },
  };
}

export function runStandardCapabilityContractSuite(
  providerName: string,
  pluginFactory: PluginFactory,
): void {
  describe(`${providerName} standard capability contracts`, () => {
    it("implements exactly the two M1 standard capabilities", async () => {
      const plugin = await pluginFactory(hostServices());
      const keys = plugin.capabilities
        .map((capability) => `${capability.id}@${capability.contractVersion}`)
        .sort();

      expect(keys).toEqual(["data_map.search_objects@1.0.0", "data_quality.get_trend@1.0.0"]);
    });

    it("maps product-specific object fields to the shared data-map meaning", async () => {
      const plugin = await pluginFactory(hostServices());
      const implementation = plugin.capabilities.find(
        (capability) => capability.id === "data_map.search_objects",
      );
      const result = dataMapSearchObjectsResultSchema.parse(
        await implementation?.execute({ keyword: "orders", limit: 10 }, context),
      );

      expect(result.status).toBe("success");
      expect(result.data?.objects[0]).toEqual(
        expect.objectContaining({ type: "data_table", id: "orders", name: "Orders" }),
      );
      expect(result.evidence).toHaveLength(1);
    });

    it("maps product-specific quality fields to percent and daily aggregation", async () => {
      const plugin = await pluginFactory(hostServices());
      const implementation = plugin.capabilities.find(
        (capability) => capability.id === "data_quality.get_trend",
      );
      const result = qualityTrendResultSchema.parse(
        await implementation?.execute(
          {
            tableId: "orders",
            startTime: "2026-10-14T00:00:00+08:00",
            endTime: "2026-10-14T23:59:59+08:00",
          },
          context,
        ),
      );

      expect(result.status).toBe("success");
      expect(result.data).toEqual(
        expect.objectContaining({
          tableId: "orders",
          metric: "quality_score",
          unit: "percent",
          aggregation: "daily",
          points: [{ time: "2026-10-14", value: 96 }],
        }),
      );
    });

    it("returns partial with explicit missing dates instead of inventing daily points", async () => {
      const plugin = await pluginFactory(hostServices());
      const implementation = plugin.capabilities.find(
        (capability) => capability.id === "data_quality.get_trend",
      );
      const result = qualityTrendResultSchema.parse(
        await implementation?.execute(
          {
            tableId: "orders",
            startTime: "2026-10-12T00:00:00+08:00",
            endTime: "2026-10-14T23:59:59+08:00",
          },
          context,
        ),
      );

      expect(result.status).toBe("partial");
      expect(result.data?.points).toEqual([{ time: "2026-10-14", value: 96 }]);
      expect(result.data?.missingDates).toEqual(["2026-10-12", "2026-10-13"]);
      expect(result.warnings[0]?.code).toBe("MISSING_DATES");
    });
  });
}
