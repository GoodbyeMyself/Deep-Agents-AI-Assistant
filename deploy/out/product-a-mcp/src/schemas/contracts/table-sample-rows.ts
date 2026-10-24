/** Tool `list_table_sample_rows` 的入参/出参 Zod 定义。 */
import { z } from "zod";

import {
  productAErrorSchema,
  productAEvidenceSchema,
  productAWarningSchema,
  sampleRowCellSchema,
} from "../shared.js";

export const productATableSampleRowsInputSchema = z
  .object({
    tableId: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .strict();

const productATableSampleRowsDataSchema = z
  .object({
    tableId: z.string().min(1),
    columns: z.array(z.string().min(1)),
    rows: z.array(z.record(z.string().min(1), sampleRowCellSchema)),
    truncated: z.boolean().optional(),
  })
  .strict();

export const productATableSampleRowsResultSchema = z
  .object({
    status: z.enum(["success", "error"]),
    data: productATableSampleRowsDataSchema.nullable(),
    evidence: z.array(productAEvidenceSchema),
    warnings: z.array(productAWarningSchema),
    error: productAErrorSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    // 与 quality-trend 相同：error 与 success 的 data/error 互斥。
    if (result.status === "error" && (result.data !== null || result.error === undefined)) {
      context.addIssue({ code: "custom", message: "Error results require null data and error." });
    }
    if (result.status === "success" && (result.data === null || result.error !== undefined)) {
      context.addIssue({
        code: "custom",
        message: "Successful results require data and no error.",
      });
    }
  });

export type ProductATableSampleRowsInput = z.infer<typeof productATableSampleRowsInputSchema>;
export type ProductATableSampleRowsResult = z.infer<typeof productATableSampleRowsResultSchema>;
