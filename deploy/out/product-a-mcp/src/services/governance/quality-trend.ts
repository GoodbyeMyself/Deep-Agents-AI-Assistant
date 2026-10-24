/**
 * Tool `get_quality_trend` 用例：编排治理微服务结果，并组装 MCP 层 Evidence / partial 语义。
 */
import type { ProductAAuthSource } from "../../api/auth-source.js";
import { resolveProductARequestContext } from "../../api/auth-context.js";
import { dataGovernanceServiceGetQualityTrend } from "../../api/clients/data-governance-service.js";
import type { ProductAQualityTrendInput, ProductAQualityTrendResult } from "../../schemas/index.js";
import { createProductAForbiddenError, isAuthorizedProductATable } from "../authorization.js";

export async function queryProductAQualityTrend(
  input: ProductAQualityTrendInput,
  auth: ProductAAuthSource,
): Promise<ProductAQualityTrendResult> {
  if (!isAuthorizedProductATable(input.tableId)) {
    return {
      status: "error",
      data: null,
      evidence: [],
      warnings: [],
      error: createProductAForbiddenError(),
    };
  }

  const ctx = resolveProductARequestContext(auth);
  const upstream = await dataGovernanceServiceGetQualityTrend(
    {
      tableId: input.tableId,
      startTime: input.startTime,
      endTime: input.endTime,
    },
    ctx,
    auth.signal,
  );

  const partial = upstream.missingDates.length > 0;
  return {
    status: partial ? "partial" : "success",
    data: {
      tableId: input.tableId,
      metric: "quality_score",
      unit: "percent",
      aggregation: "daily",
      timezone: "Asia/Shanghai",
      points: [...upstream.points],
      ...(partial ? { missingDates: [...upstream.missingDates] } : {}),
    },
    evidence: [
      {
        id: "product-a-quality-evidence",
        source: { type: "table", id: input.tableId },
        collectedAt: "2026-10-21T00:00:00+08:00",
        dataScope: { from: input.startTime, to: input.endTime },
        methodology: "Product A data-governance service daily quality score.",
        referenceId: `product-a:mcp:quality:${input.tableId}`,
      },
    ],
    dataScope: {
      start: input.startTime,
      end: input.endTime,
      timezone: "Asia/Shanghai",
    },
    warnings: partial
      ? [{ code: "MISSING_DATES", message: "Product A returned only the latest daily point." }]
      : [],
  };
}
