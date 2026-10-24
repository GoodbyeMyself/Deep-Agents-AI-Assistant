/** Tool `get_table_metadata`：元数据 + 血缘摘要。 */
import { z } from "zod";

import { productAErrorSchema, productAEvidenceSchema, productAWarningSchema } from "../shared.js";

export const productATableMetadataInputSchema = z
  .object({
    tableId: z.string().trim().min(1).max(200),
  })
  .strict();

const lineageNodeSchema = z
  .object({
    tableId: z.string().min(1),
    direction: z.enum(["upstream", "downstream"]),
  })
  .strict();

const productATableMetadataDataSchema = z
  .object({
    tableId: z.string().min(1),
    displayName: z.string().min(1),
    domain: z.string().min(1),
    ownerTeam: z.string().min(1),
    tags: z.array(z.string().min(1)),
    columnCount: z.number().int().nonnegative(),
    lineage: z.array(lineageNodeSchema),
  })
  .strict();

export const productATableMetadataResultSchema = z
  .object({
    status: z.enum(["success", "error"]),
    data: productATableMetadataDataSchema.nullable(),
    evidence: z.array(productAEvidenceSchema),
    warnings: z.array(productAWarningSchema),
    error: productAErrorSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
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

export type ProductATableMetadataInput = z.infer<typeof productATableMetadataInputSchema>;
export type ProductATableMetadataResult = z.infer<typeof productATableMetadataResultSchema>;
