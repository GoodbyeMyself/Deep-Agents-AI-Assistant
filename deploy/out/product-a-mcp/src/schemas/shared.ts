/**
 * 多个 Tool 共用的结果片段 Schema（错误、警告、Evidence）。
 * 各 Tool 的 data 形状不同，不在此统一业务载荷。
 */
import { z } from "zod";

export const productAErrorSchema = z
  .object({
    code: z.enum([
      "FORBIDDEN",
      "INVALID_INPUT",
      "INSUFFICIENT_DATA",
      "UPSTREAM_TIMEOUT",
      "UPSTREAM_ERROR",
    ]),
    message: z.string().min(1),
    retryable: z.boolean(),
  })
  .strict();

export const productAWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

/** Evidence 仅含 opaque referenceId；解析引用时须按当前主体在原系统重新鉴权。 */
export const productAEvidenceSchema = z
  .object({
    id: z.string().min(1),
    source: z
      .object({
        type: z.enum(["table", "dataset", "metric", "record", "task", "document", "service"]),
        id: z.string().min(1),
        title: z.string().optional(),
      })
      .strict(),
    collectedAt: z.iso.datetime({ offset: true }),
    dataScope: z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .strict()
      .optional(),
    methodology: z.string().min(1).optional(),
    referenceId: z.string().min(1),
  })
  .strict();

/** 样本行单元格允许的类型（与脱敏后字段类型一致，不含 object/array）。 */
export const sampleRowCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
