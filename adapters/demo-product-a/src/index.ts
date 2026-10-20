import {
  dataMapGetObjectMetadataV1,
  dataMapSearchObjectsV1,
  type DataMapGetObjectMetadataInput,
  type DataMapGetObjectMetadataResult,
  type DataMapSearchObjectsInput,
  type DataMapSearchObjectsResult,
} from "@assistant/capability-data-map";
import {
  qualityTrendV1,
  type QualityTrendInput,
  type QualityTrendResult,
} from "@assistant/capability-data-quality";
import type { CapabilityExecutionContext } from "@assistant/capability-core";
import { definePlugin, implementCapability } from "@assistant/plugin-sdk";

interface ProductAObject {
  resourceType: string;
  resourceCode: string;
  displayName: string;
  summary: string;
}

interface ProductAQualityPoint {
  tableCode: string;
  statDate: string;
  qualityScore: number;
}

interface ProductAColumnDefinition {
  columnCode: string;
  label: string;
  storageType: "VARCHAR" | "BIGINT";
  required: boolean;
  comment: string;
  sensitivity: "INTERNAL" | "RESTRICTED";
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

function queryObjects(input: DataMapSearchObjectsInput): ProductAObject[] {
  if (!"orders".includes(input.keyword.toLowerCase())) return [];
  return [
    {
      resourceType: "TABLE",
      resourceCode: "orders",
      displayName: "Orders",
      summary: "Authorized order records.",
    },
  ];
}

function getQualityPoint(input: QualityTrendInput): ProductAQualityPoint {
  return { tableCode: input.tableId, statDate: input.endTime.slice(0, 10), qualityScore: 96 };
}

function describeColumns(objectId: string): ProductAColumnDefinition[] {
  if (objectId !== "orders") return [];
  return [
    {
      columnCode: "order_id",
      label: "Order ID",
      storageType: "BIGINT",
      required: true,
      comment: "Stable order identifier.",
      sensitivity: "INTERNAL",
    },
    {
      columnCode: "customer_ssn",
      label: "Customer SSN",
      storageType: "VARCHAR",
      required: true,
      comment: "Restricted customer identifier.",
      sensitivity: "RESTRICTED",
    },
  ];
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
      message: "Product A denied this business object.",
      retryable: false,
    },
  };
}

function searchObjects(
  input: DataMapSearchObjectsInput,
  context: CapabilityExecutionContext,
): Promise<DataMapSearchObjectsResult> {
  if (!authorized(context)) return Promise.resolve(forbiddenResult());
  const raw = queryObjects(input)
    .filter((item) => (context.authorizedObjectIds ?? []).includes(item.resourceCode))
    .slice(0, input.limit ?? 20);
  return Promise.resolve({
    status: "success",
    data: {
      objects: raw.map((item) => ({
        type: item.resourceType === "TABLE" ? "data_table" : item.resourceType.toLowerCase(),
        id: item.resourceCode,
        name: item.displayName,
        description: item.summary,
        sourceRef: `product-a:${item.resourceCode}`,
      })),
    },
    evidence: [
      {
        id: "product-a-search-evidence",
        source: { type: "service", id: "product-a-data-map" },
        collectedAt: "2026-10-14T00:00:00+08:00",
        methodology: "Product A authorized metadata search mapped to the standard contract.",
        referenceId: `product-a:${context.executionContextId}:search:orders`,
      },
    ],
    warnings: [],
  });
}

function getObjectMetadata(
  input: DataMapGetObjectMetadataInput,
  context: CapabilityExecutionContext,
): Promise<DataMapGetObjectMetadataResult> {
  if (!authorized(context, input.objectId) || input.objectType !== "data_table") {
    return Promise.resolve(forbiddenResult());
  }
  const requested = input.fieldNames === undefined ? undefined : new Set(input.fieldNames);
  const candidates = describeColumns(input.objectId).filter(
    (field) => requested === undefined || requested.has(field.columnCode),
  );
  const canReadRestricted = context.permissionScopes.includes("data_map:sensitive_read");
  const visible = candidates.filter(
    (field) => field.sensitivity !== "RESTRICTED" || canReadRestricted,
  );
  const withheld = candidates.length - visible.length;
  return Promise.resolve({
    status: withheld > 0 ? "partial" : "success",
    data: {
      object: {
        type: "data_table",
        id: input.objectId,
        name: "Orders",
        description: "Authorized order records.",
      },
      fields: visible.map((field) => ({
        name: field.columnCode,
        displayName: field.label,
        dataType: field.storageType === "BIGINT" ? "number" : "string",
        nullable: !field.required,
        description: field.comment,
        classification: field.sensitivity === "RESTRICTED" ? "restricted" : "internal",
      })),
    },
    evidence: [
      {
        id: "product-a-metadata-evidence",
        source: { type: "table", id: input.objectId, title: "Orders" },
        collectedAt: "2026-10-20T00:00:00+08:00",
        methodology: "Product A object and field authorization applied before standard mapping.",
        referenceId: `product-a:${context.executionContextId}:metadata:${input.objectId}`,
      },
    ],
    warnings:
      withheld > 0
        ? [
            {
              code: "FIELD_ACCESS_RESTRICTED",
              message: `${withheld} requested field(s) were omitted by field-level authorization.`,
            },
          ]
        : [],
  });
}

function getTrend(
  input: QualityTrendInput,
  context: CapabilityExecutionContext,
): Promise<QualityTrendResult> {
  if (!authorized(context, input.tableId)) return Promise.resolve(forbiddenResult());
  const raw = getQualityPoint(input);
  const missingDates = listMissingDates(input.startTime, input.endTime);
  const partial = missingDates.length > 0;
  return Promise.resolve({
    status: partial ? "partial" : "success",
    data: {
      tableId: raw.tableCode,
      metric: "quality_score",
      unit: "percent",
      aggregation: "daily",
      timezone: "Asia/Shanghai",
      points: [{ time: raw.statDate, value: raw.qualityScore }],
      ...(partial ? { missingDates } : {}),
    },
    evidence: [
      {
        id: "product-a-quality-evidence",
        source: { type: "table", id: raw.tableCode },
        collectedAt: "2026-10-14T00:00:00+08:00",
        dataScope: { from: input.startTime, to: input.endTime },
        methodology: "Product A daily quality score mapped without filling missing dates.",
        referenceId: `product-a:${context.executionContextId}:quality:${raw.tableCode}`,
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
  });
}

export default definePlugin((host) => ({
  capabilities: [
    implementCapability({ contract: dataMapSearchObjectsV1, execute: searchObjects }),
    implementCapability({ contract: dataMapGetObjectMetadataV1, execute: getObjectMetadata }),
    implementCapability({ contract: qualityTrendV1, execute: getTrend }),
  ],
  initialize: () => {
    host.logger.info("Demo Product A adapter initialized.");
    return Promise.resolve();
  },
  healthCheck: () => Promise.resolve({ ok: true }),
}));
