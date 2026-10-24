/**
 * 平台 canonical 事件信封（GET /api/v1/runs/{id}/events）。
 *
 * `data` 刻意保持 loose record：各 `type` 的字段约束由 producer（agent-server/runner）
 * 与 consumer（assistant-ui store、ag-ui/projection）分别校验，避免在此包耦合所有载荷 schema。
 */
import { z } from "zod";

/** 单条 SSE 事件的 `type` 字段；新增类型须保持 schemaVersion 兼容策略。 */
export const assistantEventTypeSchema = z.enum([
  "run.started",
  "message.delta",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "evidence.added",
  "view.created",
  "subagent.started",
  "subagent.completed",
  "approval.required",
  "run.interrupted",
  "run.completed",
  "run.failed",
  "run.cancelled",
]);

/**
 * 版本化事件信封。`data` 按 `type` 携带载荷，由消费方（如 assistant-ui store）解析。
 * `eventId` + `sequence` 供客户端去重与断线重连游标。
 */
export const assistantEventSchema = z.object({
  schemaVersion: z.literal("1"),
  eventId: z.string().min(1),
  sequence: z.number().int().positive(),
  sessionId: z.string().uuid(),
  runId: z.string().uuid(),
  timestamp: z.iso.datetime({ offset: true }),
  type: assistantEventTypeSchema,
  data: z.record(z.string(), z.unknown()),
});

export type AssistantEvent = z.infer<typeof assistantEventSchema>;
export type AssistantEventType = z.infer<typeof assistantEventTypeSchema>;
