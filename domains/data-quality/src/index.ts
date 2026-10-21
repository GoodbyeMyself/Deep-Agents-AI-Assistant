/**
 * 数据质量（data-quality）领域能力契约。
 *
 * 本文件只声明「契约」：入参/出参形状、权限与风险元数据，不包含具体 HTTP 或数据库调用。
 * 执行层（Adapter / Mock）必须按此处 Schema 校验后再返回，注册表用 `dataQualityCapabilityContracts` 挂载。
 */
import {
  CAPABILITY_CONTRACT_VERSION,
  createCapabilityResultSchema,
  type CapabilityContract,
  type PlatformCapabilitySource,
} from "@assistant/capability-core";
import { z } from "zod";

/**
 * 平台内置能力来源，写入 Capability Catalog 的 registration.source。
 * - `type: "platform"`：与插件 Adapter（plugin source）区分，便于审计与按来源筛选。
 * - `id`：稳定包名式标识，勿与业务表名或环境相关字符串混用。
 */
export const DATA_QUALITY_CAPABILITY_SOURCE = {
  type: "platform",
  id: "@assistant/capability-data-quality",
} as const satisfies PlatformCapabilitySource;

/** 质量趋势查询允许的最大时间跨度（31 天），单位毫秒。 */
const MAX_QUALITY_TREND_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/**
 * Capability `data_quality.get_trend` 的入参 Schema。
 *
 * - `.strict()`：拒绝未在契约中声明的额外字段，避免 Agent/客户端悄悄传入未评审参数。
 * - `.superRefine()`：跨字段规则，单字段 Zod 类型无法表达「end ≥ start」与跨度上限。
 */
export const qualityTrendInputSchema = z
  .object({
    /** 业务侧数据表唯一标识；trim 后非空，长度上限防止异常超长 ID 打满日志/URL。 */
    tableId: z.string().trim().min(1).max(200),
    /** 区间起点，须为带时区偏移的 ISO 8601（与 output dataScope 时间语义一致）。 */
    startTime: z.iso.datetime({ offset: true }),
    /** 区间终点；与 startTime 共同受 superRefine 约束。 */
    endTime: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((input, context) => {
    const start = Date.parse(input.startTime);
    const end = Date.parse(input.endTime);

    // 已用 z.iso.datetime 校验格式，此处 parse 用于比较时间先后与跨度。
    if (end < start) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "endTime precedes startTime.",
      });
      return;
    }

    if (end - start > MAX_QUALITY_TREND_RANGE_MS) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The quality trend range cannot exceed 31 days.",
      });
    }
  });

/**
 * 趋势查询成功时 `CapabilityResult.data` 的业务载荷（不含 status/evidence 等信封字段）。
 *
 * 当前 V1 仅支持单一指标 `quality_score`、按日聚合、单位为百分比；扩展新 metric 应新增契约版本或新 capability id。
 */
export const qualityTrendDataSchema = z
  .object({
    /** 与入参 tableId 对应，便于客户端核对响应是否错表。 */
    tableId: z.string().min(1),
    /** 固定字面量，防止实现返回未约定的指标名。 */
    metric: z.literal("quality_score"),
    unit: z.literal("percent"),
    aggregation: z.literal("daily"),
    /** 聚合/展示所用时区（如 IANA 名称），与 points 中 date 的「日历日」解释一致。 */
    timezone: z.string().min(1),
    /**
     * 按日的质量分序列；`time` 为日历日期（iso.date），`value` 为 0–100 闭区间。
     * 未出现的日期可由 missingDates 单独说明（如无采样、权限裁剪等）。
     */
    points: z.array(
      z
        .object({
          time: z.iso.date(),
          value: z.number().min(0).max(100),
        })
        .strict(),
    ),
    /** 请求区间内应有日点但无数据的日期列表（可选，由实现方在 partial 场景配合 warnings 使用）。 */
    missingDates: z.array(z.iso.date()).optional(),
  })
  .strict();

/**
 * 完整工具输出 Schema：`createCapabilityResultSchema` 在 data 外包裹
 * status / evidence / dataScope / warnings / error 等统一字段，并约束 success|partial|error 与 data 的一致性。
 */
export const qualityTrendResultSchema = createCapabilityResultSchema(qualityTrendDataSchema);

/** 入参 TypeScript 类型，与 qualityTrendInputSchema 保持同步。 */
export type QualityTrendInput = z.infer<typeof qualityTrendInputSchema>;
/** 成功载荷类型（对应 result.data 在 status=success 时的形状）。 */
export type QualityTrendData = z.infer<typeof qualityTrendDataSchema>;
/** Agent / API 消费的完整结果类型。 */
export type QualityTrendResult = z.infer<typeof qualityTrendResultSchema>;

/**
 * 注册到 Catalog 的 V1 契约对象。
 *
 * - `id` + `version`：全局唯一键（见 capability-core `capabilityKey`）。
 * - `requiredPermission`：策略层声明所需权限码；真正授权仍在业务 API / 服务端强制执行。
 * - `riskLevel: "read"`：只读能力，用于审批与工具暴露策略分级。
 */
export const qualityTrendV1 = {
  id: "data_quality.get_trend",
  version: CAPABILITY_CONTRACT_VERSION,
  description: "Get the authorized daily quality-score trend for a data table.",
  inputSchema: qualityTrendInputSchema,
  outputSchema: qualityTrendResultSchema,
  requiredPermission: "data_quality:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

/** 本领域全部契约列表；新增能力时在此追加并保持 `as const` 以收窄字面量类型。 */
export const dataQualityCapabilityContracts = [qualityTrendV1] as const;
