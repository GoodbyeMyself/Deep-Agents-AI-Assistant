/**
 * 宿主导航动作契约（AG-UI Host Action / View action.navigate）。
 *
 * 安全模型：只传递 opaque `target` 键与有限标量参数；真实 URL、路由或 DOM 操作由宿主 allowlist 解析。
 */
import { z } from "zod";

/** 小写开头的 dotted/slug 动作键，供宿主静态映射表索引。 */
const actionKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/);
const actionLabelSchema = z.string().trim().min(1).max(80);
const parameterValueSchema = z.union([z.string().max(300), z.number(), z.boolean(), z.null()]);

export const hostActionParametersSchema = z
  .record(z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/), parameterValueSchema)
  .refine((value) => Object.keys(value).length <= 16, "Host action has too many parameters.");

/**
 * 模型和 iframe 只能请求一个不透明动作键。宿主必须以本地 allowlist 将它映射为页面行为；
 * 该契约刻意不接受 URL、路径、脚本或 HTML。
 */
export const hostNavigationActionSchema = z
  .object({
    type: z.literal("host.navigate"),
    target: actionKeySchema,
    label: actionLabelSchema,
    parameters: hostActionParametersSchema.optional(),
  })
  .strict();

export type HostNavigationAction = z.infer<typeof hostNavigationActionSchema>;
