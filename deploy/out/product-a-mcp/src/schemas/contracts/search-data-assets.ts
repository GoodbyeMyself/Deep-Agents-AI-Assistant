/** Tool `search_data_assets`：跨目录检索数据资产。 */
import { z } from "zod";

import { productAErrorSchema, productAEvidenceSchema, productAWarningSchema } from "../shared.js";

export const productASearchDataAssetsInputSchema = z
  .object({
    keyword: z.string().trim().min(1).max(120),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict();

const assetHitSchema = z
  .object({
    assetId: z.string().min(1),
    assetType: z.enum(["table", "dataset", "metric"]),
    name: z.string().min(1),
    domain: z.string().min(1),
  })
  .strict();

const productASearchDataAssetsDataSchema = z
  .object({
    keyword: z.string().min(1),
    total: z.number().int().nonnegative(),
    assets: z.array(assetHitSchema),
  })
  .strict();

export const productASearchDataAssetsResultSchema = z
  .object({
    status: z.enum(["success", "error"]),
    data: productASearchDataAssetsDataSchema.nullable(),
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

export type ProductASearchDataAssetsInput = z.infer<typeof productASearchDataAssetsInputSchema>;
export type ProductASearchDataAssetsResult = z.infer<typeof productASearchDataAssetsResultSchema>;
