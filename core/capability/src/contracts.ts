import { z } from "zod";

export const CAPABILITY_CONTRACT_VERSION = "1.0.0";

export const capabilityErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "UNSUPPORTED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_ERROR",
  "SCHEMA_MISMATCH",
  "INSUFFICIENT_DATA",
  "PROVIDER_UNAVAILABLE",
]);

export type CapabilityErrorCode = z.infer<typeof capabilityErrorCodeSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  source: z.object({
    type: z.enum(["table", "dataset", "metric", "record", "task", "document", "service"]),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  collectedAt: z.iso.datetime({ offset: true }),
  dataScope: z
    .object({
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  methodology: z.string().min(1).optional(),
  referenceId: z.string().min(1),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const capabilityWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const capabilityErrorSchema = z.object({
  code: capabilityErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});

export function createCapabilityResultSchema<DataSchema extends z.ZodType>(dataSchema: DataSchema) {
  return z
    .object({
      status: z.enum(["success", "partial", "error"]),
      data: dataSchema.nullable(),
      evidence: z.array(evidenceSchema),
      dataScope: z
        .object({
          start: z.iso.datetime({ offset: true }).optional(),
          end: z.iso.datetime({ offset: true }).optional(),
          filters: z.record(z.string(), z.unknown()).optional(),
          timezone: z.string().min(1).optional(),
        })
        .optional(),
      warnings: z.array(capabilityWarningSchema),
      error: capabilityErrorSchema.optional(),
    })
    .superRefine((result, context) => {
      const checkedResult = result as unknown as {
        status: "success" | "partial" | "error";
        data: unknown;
        warnings: unknown[];
        error?: unknown;
      };
      if (checkedResult.status === "success" && checkedResult.data === null) {
        context.addIssue({ code: "custom", message: "A successful result must contain data." });
      }
      if (checkedResult.status === "partial" && checkedResult.warnings.length === 0) {
        context.addIssue({ code: "custom", message: "A partial result must explain its limits." });
      }
      if (
        checkedResult.status === "error" &&
        (checkedResult.data !== null || checkedResult.error === undefined)
      ) {
        context.addIssue({
          code: "custom",
          message: "An error result must have null data and a standard error.",
        });
      }
    });
}

export const dataMapSearchObjectsInputSchema = z
  .object({
    keyword: z.string().trim().min(1).max(200),
    objectTypes: z.array(z.string().min(1)).max(20).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    scope: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const dataMapObjectSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sourceRef: z.string().min(1),
});

export const dataMapSearchObjectsDataSchema = z.object({
  objects: z.array(dataMapObjectSchema),
  nextCursor: z.string().min(1).optional(),
});

export const dataMapSearchObjectsResultSchema = createCapabilityResultSchema(
  dataMapSearchObjectsDataSchema,
);

const MAX_QUALITY_TREND_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

export const qualityTrendInputSchema = z
  .object({
    tableId: z.string().trim().min(1).max(200),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((input, context) => {
    const start = Date.parse(input.startTime);
    const end = Date.parse(input.endTime);
    if (end < start) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "endTime precedes startTime.",
      });
    } else if (end - start > MAX_QUALITY_TREND_RANGE_MS) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The quality trend range cannot exceed 31 days.",
      });
    }
  });

export const qualityTrendDataSchema = z.object({
  tableId: z.string().min(1),
  metric: z.literal("quality_score"),
  unit: z.literal("percent"),
  aggregation: z.literal("daily"),
  timezone: z.string().min(1),
  points: z.array(
    z.object({
      time: z.iso.date(),
      value: z.number().min(0).max(100),
    }),
  ),
  missingDates: z.array(z.iso.date()).optional(),
});

export const qualityTrendResultSchema = createCapabilityResultSchema(qualityTrendDataSchema);

export type DataMapSearchObjectsInput = z.infer<typeof dataMapSearchObjectsInputSchema>;
export type DataMapSearchObjectsData = z.infer<typeof dataMapSearchObjectsDataSchema>;
export type DataMapSearchObjectsResult = z.infer<typeof dataMapSearchObjectsResultSchema>;
export type QualityTrendInput = z.infer<typeof qualityTrendInputSchema>;
export type QualityTrendData = z.infer<typeof qualityTrendDataSchema>;
export type QualityTrendResult = z.infer<typeof qualityTrendResultSchema>;

export interface CapabilityContract<
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: InputSchema;
  readonly outputSchema: OutputSchema;
  readonly requiredPermission: string;
  readonly riskLevel: "read" | "write" | "high";
}

export const dataMapSearchObjectsV1 = {
  id: "data_map.search_objects",
  version: CAPABILITY_CONTRACT_VERSION,
  description: "Search authorized business data objects using the standard data-map contract.",
  inputSchema: dataMapSearchObjectsInputSchema,
  outputSchema: dataMapSearchObjectsResultSchema,
  requiredPermission: "data_map:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

export const qualityTrendV1 = {
  id: "data_quality.get_trend",
  version: CAPABILITY_CONTRACT_VERSION,
  description: "Get the authorized daily quality-score trend for a data table.",
  inputSchema: qualityTrendInputSchema,
  outputSchema: qualityTrendResultSchema,
  requiredPermission: "data_quality:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

export type KnownCapabilityContract = typeof dataMapSearchObjectsV1 | typeof qualityTrendV1;

export const standardCapabilityContracts = [
  dataMapSearchObjectsV1,
  qualityTrendV1,
] as const satisfies readonly KnownCapabilityContract[];

export function capabilityKey(id: string, version: string): string {
  return `${id}@${version}`;
}
