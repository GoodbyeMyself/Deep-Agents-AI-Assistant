import { describe, expect, it } from "vitest";

import {
  dataMapSearchObjectsInputSchema,
  qualityTrendInputSchema,
  qualityTrendResultSchema,
} from "./index.js";

describe("quality trend contract", () => {
  it("rejects an invalid timestamp before an adapter can run", () => {
    const parsed = qualityTrendInputSchema.safeParse({
      tableId: "table-1",
      startTime: "not-a-date",
      endTime: "2026-10-13T00:00:00+08:00",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a reversed or oversized time range", () => {
    expect(
      qualityTrendInputSchema.safeParse({
        tableId: "table-1",
        startTime: "2026-10-14T00:00:00+08:00",
        endTime: "2026-10-13T00:00:00+08:00",
      }).success,
    ).toBe(false);
    expect(
      qualityTrendInputSchema.safeParse({
        tableId: "table-1",
        startTime: "2026-01-01T00:00:00+08:00",
        endTime: "2026-10-13T00:00:00+08:00",
      }).success,
    ).toBe(false);
  });

  it("enforces data-map query limits", () => {
    expect(
      dataMapSearchObjectsInputSchema.safeParse({ keyword: "orders", limit: 51 }).success,
    ).toBe(false);
  });

  it("accepts a result carrying evidence", () => {
    const parsed = qualityTrendResultSchema.parse({
      status: "success",
      data: {
        tableId: "table-1",
        metric: "quality_score",
        unit: "percent",
        aggregation: "daily",
        timezone: "Asia/Shanghai",
        points: [{ time: "2026-10-13", value: 96 }],
      },
      evidence: [
        {
          id: "evidence-1",
          source: { type: "table", id: "table-1" },
          collectedAt: "2026-10-13T00:00:00+08:00",
          referenceId: "reference-1",
        },
      ],
      warnings: [],
    });

    expect(parsed.evidence[0]?.referenceId).toBe("reference-1");
  });

  it("requires warnings for partial results", () => {
    const parsed = qualityTrendResultSchema.safeParse({
      status: "partial",
      data: {
        tableId: "table-1",
        metric: "quality_score",
        unit: "percent",
        aggregation: "daily",
        timezone: "Asia/Shanghai",
        points: [],
        missingDates: ["2026-10-13"],
      },
      evidence: [],
      warnings: [],
    });

    expect(parsed.success).toBe(false);
  });
});
