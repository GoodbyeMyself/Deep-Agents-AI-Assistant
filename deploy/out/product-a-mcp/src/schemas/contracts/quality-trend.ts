/** Tool `get_quality_trend` 的入参/出参 Zod 定义（模型可见契约）。 */
import { z } from "zod";

import { productAErrorSchema, productAEvidenceSchema, productAWarningSchema } from "../shared.js";

/** Product A 业务规则：单次查询时间跨度上限（与 Mock/API 一致）。 */
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

export const productAQualityTrendInputSchema = z
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
      return;
    }
    if (end - start > MAX_RANGE_MS) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The Product A quality trend range cannot exceed 31 days.",
      });
    }
  });

const productAQualityTrendDataSchema = z
  .object({
    tableId: z.string().min(1),
    metric: z.literal("quality_score"),
    unit: z.literal("percent"),
    aggregation: z.literal("daily"),
    timezone: z.string().min(1),
    points: z.array(
      z
        .object({
          time: z.iso.date(),
          value: z.number().min(0).max(100),
        })
        .strict(),
    ),
    missingDates: z.array(z.iso.date()).optional(),
  })
  .strict();

export const productAQualityTrendResultSchema = z
  .object({
    status: z.enum(["success", "partial", "error"]),
    data: productAQualityTrendDataSchema.nullable(),
    evidence: z.array(productAEvidenceSchema),
    dataScope: z
      .object({
        start: z.string().optional(),
        end: z.string().optional(),
        timezone: z.string().optional(),
      })
      .strict()
      .optional(),
    warnings: z.array(productAWarningSchema),
    error: productAErrorSchema.optional(),
  })
  .strict()
  // 保证 status 与 data/error 组合一致，避免 handler 返回无法通过 outputSchema 校验的结构。
  .superRefine((result, context) => {
    if (result.status === "error" && (result.data !== null || result.error === undefined)) {
      context.addIssue({ code: "custom", message: "Error results require null data and error." });
    }
    if (result.status !== "error" && (result.data === null || result.error !== undefined)) {
      context.addIssue({
        code: "custom",
        message: "Successful or partial results require data and no error.",
      });
    }
  });

export type ProductAQualityTrendInput = z.infer<typeof productAQualityTrendInputSchema>;
export type ProductAQualityTrendResult = z.infer<typeof productAQualityTrendResultSchema>;
