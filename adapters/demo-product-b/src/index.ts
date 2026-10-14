import {
  dataMapSearchObjectsV1,
  qualityTrendV1,
  type DataMapSearchObjectsInput,
  type DataMapSearchObjectsResult,
  type QualityTrendInput,
  type QualityTrendResult,
  type CapabilityExecutionContext,
} from "@assistant/capability-contracts";
import { definePlugin, implementCapability } from "@assistant/plugin-sdk";

interface ProductBAsset {
  kind: string;
  assetId: string;
  label: string;
  details: string;
}

interface ProductBQualityPoint {
  assetId: string;
  date: string;
  qualityRate: number;
}

function listMissingDates(startTime: string, endTime: string): string[] {
  const current = new Date(`${startTime.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${endTime.slice(0, 10)}T00:00:00Z`);
  const dates: string[] = [];
  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function findAssets(input: DataMapSearchObjectsInput): ProductBAsset[] {
  if (!"orders".includes(input.keyword.toLowerCase())) return [];
  return [
    {
      kind: "TABLE_ASSET",
      assetId: "orders",
      label: "Orders",
      details: "Authorized order records.",
    },
  ];
}

function fetchQuality(input: QualityTrendInput): ProductBQualityPoint {
  return { assetId: input.tableId, date: input.endTime.slice(0, 10), qualityRate: 0.96 };
}

function authorized(context: CapabilityExecutionContext, objectId?: string): boolean {
  return (
    context.authorizationRef === `mock-auth:${context.principalId}` &&
    (objectId === undefined || (context.authorizedObjectIds ?? []).includes(objectId))
  );
}

function forbiddenResult() {
  return {
    status: "error" as const,
    data: null,
    evidence: [],
    warnings: [],
    error: {
      code: "FORBIDDEN" as const,
      message: "Product B denied this business object.",
      retryable: false,
    },
  };
}

function searchObjects(
  input: DataMapSearchObjectsInput,
  context: CapabilityExecutionContext,
): Promise<DataMapSearchObjectsResult> {
  if (!authorized(context)) return Promise.resolve(forbiddenResult());
  const raw = findAssets(input)
    .filter((item) => (context.authorizedObjectIds ?? []).includes(item.assetId))
    .slice(0, input.limit ?? 20);
  return Promise.resolve({
    status: "success",
    data: {
      objects: raw.map((item) => ({
        type: item.kind === "TABLE_ASSET" ? "data_table" : item.kind.toLowerCase(),
        id: item.assetId,
        name: item.label,
        description: item.details,
        sourceRef: `product-b:${item.assetId}`,
      })),
    },
    evidence: [
      {
        id: "product-b-search-evidence",
        source: { type: "service", id: "product-b-catalog" },
        collectedAt: "2026-10-14T00:00:00+08:00",
        methodology: "Product B authorized asset lookup mapped to the standard contract.",
        referenceId: `product-b:${context.executionContextId}:search:orders`,
      },
    ],
    warnings: [],
  });
}

function getTrend(
  input: QualityTrendInput,
  context: CapabilityExecutionContext,
): Promise<QualityTrendResult> {
  if (!authorized(context, input.tableId)) return Promise.resolve(forbiddenResult());
  const raw = fetchQuality(input);
  const missingDates = listMissingDates(input.startTime, input.endTime);
  const partial = missingDates.length > 0;
  return Promise.resolve({
    status: partial ? "partial" : "success",
    data: {
      tableId: raw.assetId,
      metric: "quality_score",
      unit: "percent",
      aggregation: "daily",
      timezone: "Asia/Shanghai",
      points: [{ time: raw.date, value: raw.qualityRate * 100 }],
      ...(partial ? { missingDates } : {}),
    },
    evidence: [
      {
        id: "product-b-quality-evidence",
        source: { type: "table", id: raw.assetId },
        collectedAt: "2026-10-14T00:00:00+08:00",
        dataScope: { from: input.startTime, to: input.endTime },
        methodology: "Product B ratio converted to percent without filling missing dates.",
        referenceId: `product-b:${context.executionContextId}:quality:${raw.assetId}`,
      },
    ],
    dataScope: {
      start: input.startTime,
      end: input.endTime,
      timezone: "Asia/Shanghai",
    },
    warnings: partial
      ? [{ code: "MISSING_DATES", message: "Product B returned only the latest daily point." }]
      : [],
  });
}

export default definePlugin((host) => ({
  capabilities: [
    implementCapability({ contract: dataMapSearchObjectsV1, execute: searchObjects }),
    implementCapability({ contract: qualityTrendV1, execute: getTrend }),
  ],
  initialize: () => {
    host.logger.info("Demo Product B adapter initialized.");
    return Promise.resolve();
  },
  healthCheck: () => Promise.resolve({ ok: true }),
}));
