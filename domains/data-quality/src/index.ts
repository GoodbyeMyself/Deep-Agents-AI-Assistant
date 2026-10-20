import {
  CAPABILITY_CONTRACT_VERSION,
  createCapabilityResultSchema,
  type CapabilityContract,
  type PlatformCapabilitySource,
} from "@assistant/capability-core";
import { z } from "zod";

export const DATA_QUALITY_CAPABILITY_SOURCE = {
  type: "platform",
  id: "@assistant/capability-data-quality",
} as const satisfies PlatformCapabilitySource;

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
      context.addIssue({ code: "custom", path: ["endTime"], message: "endTime precedes startTime." });
    } else if (end - start > MAX_QUALITY_TREND_RANGE_MS) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The quality trend range cannot exceed 31 days.",
      });
    }
  });

export const qualityTrendDataSchema = z
  .object({
    tableId: z.string().min(1),
    metric: z.literal("quality_score"),
    unit: z.literal("percent"),
    aggregation: z.literal("daily"),
    timezone: z.string().min(1),
    points: z.array(z.object({ time: z.iso.date(), value: z.number().min(0).max(100) }).strict()),
    missingDates: z.array(z.iso.date()).optional(),
  })
  .strict();

export const qualityTrendResultSchema = createCapabilityResultSchema(qualityTrendDataSchema);

export type QualityTrendInput = z.infer<typeof qualityTrendInputSchema>;
export type QualityTrendData = z.infer<typeof qualityTrendDataSchema>;
export type QualityTrendResult = z.infer<typeof qualityTrendResultSchema>;

export const qualityTrendV1 = {
  id: "data_quality.get_trend",
  version: CAPABILITY_CONTRACT_VERSION,
  description: "Get the authorized daily quality-score trend for a data table.",
  inputSchema: qualityTrendInputSchema,
  outputSchema: qualityTrendResultSchema,
  requiredPermission: "data_quality:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

export const dataQualityCapabilityContracts = [qualityTrendV1] as const;
