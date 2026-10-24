/**
 * 受控 ViewModel 联合类型。新增 viewType 必须同步 AssistantViewRenderer 与 SSE view.created 投影。
 */
import { z } from "zod";

import { hostNavigationActionSchema } from "./host-actions.js";

const viewBaseSchema = z.object({
  viewId: z.string().uuid(),
  schemaVersion: z.literal("1"),
  title: z.string().min(1).optional(),
  evidenceIds: z.array(z.string()),
});

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * UI 白名单渲染协议。插件和模型不能通过该协议注入任意 HTML、脚本或组件。
 */
export const assistantViewSchema = z.discriminatedUnion("viewType", [
  viewBaseSchema.extend({
    viewType: z.literal("text"),
    data: z.object({ content: z.string() }),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("metric"),
    data: z.object({
      label: z.string(),
      value: scalarSchema,
      unit: z.string().optional(),
      trend: z.enum(["up", "down", "flat"]).optional(),
    }),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("table"),
    data: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string(), scalarSchema)),
    }),
  }),
  // chart.line 要求 title 必填，与 metric/table 可选 title 的 base 形态不同，故单独定义。
  z.object({
    viewId: z.string().uuid(),
    viewType: z.literal("chart.line"),
    schemaVersion: z.literal("1"),
    title: z.string().min(1),
    data: z.object({
      xField: z.literal("time"),
      yField: z.literal("value"),
      rows: z.array(z.object({ time: z.string(), value: z.number() })),
    }),
    evidenceIds: z.array(z.string()),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("references"),
    data: z.object({
      items: z.array(z.object({ referenceId: z.string(), title: z.string().optional() })),
    }),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("action.navigate"),
    data: hostNavigationActionSchema,
  }),
]);

export type AssistantView = z.infer<typeof assistantViewSchema>;
