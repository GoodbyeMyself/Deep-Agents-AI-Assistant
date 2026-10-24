/**
 * AG-UI 1.0 官方类型校验 + 企业扩展 CUSTOM 事件与投影 metadata。
 *
 * 依赖 @ag-ui/core 的 EventSchema / RunAgentInputSchema，不在此 fork 官方事件形状。
 */
import { EventType, PROTOCOL_VERSION, type Event, type RunAgentInput } from "@ag-ui/core";
import { EventSchema, RunAgentInputSchema } from "@ag-ui/core/schemas";
import { z } from "zod";

import { assistantViewSchema } from "../ui/views.js";

export { EventType } from "@ag-ui/core";
export type { Interrupt as AgUiInterrupt, ResumeEntry as AgUiResumeEntry } from "@ag-ui/core";

/** 写入 AG-UI Event.metadata，供 cursor 与审计关联回源 AssistantEvent。 */
export const ENTERPRISE_ASSISTANT_METADATA_KEY = "enterprise-assistant";
export const AG_UI_PROTOCOL_VERSION = PROTOCOL_VERSION;
/** 平台 evidence.added 在 AG-UI 侧的 CUSTOM 事件名（版本化字符串，非 EventType 枚举值）。 */
export const EVIDENCE_ADDED_EVENT_NAME = "enterprise.evidence.added.v1";
export const VIEW_CREATED_EVENT_NAME = "enterprise.view.created.v1";

/** 每条投影 AG-UI 事件携带，用于 1:N 展开时的唯一 eventId 与重放游标。 */
export const enterpriseAssistantMetadataSchema = z
  .object({
    eventId: z.string().min(1),
    sourceEventId: z.string().min(1),
    projectionIndex: z.number().int().nonnegative(),
    sequence: z.number().int().positive(),
    sessionId: z.string().uuid(),
    schemaVersion: z.literal("1"),
  })
  .strict();

export const enterpriseEvidenceAddedValueSchema = z
  .object({
    referenceId: z.string().min(1),
    sourceType: z.string().min(1).optional(),
  })
  .strict();

export const enterpriseAssistantCustomEventSchema = z.discriminatedUnion("name", [
  z.object({
    type: z.literal(EventType.CUSTOM),
    name: z.literal(EVIDENCE_ADDED_EVENT_NAME),
    value: enterpriseEvidenceAddedValueSchema,
  }),
  z.object({
    type: z.literal(EventType.CUSTOM),
    name: z.literal(VIEW_CREATED_EVENT_NAME),
    value: assistantViewSchema,
  }),
]);

export type AgUiEvent = Event;
export type AgUiRunAgentInput = RunAgentInput;

/**
 * AG-UI 的 Zod 输出类型把可选字段推导为 `field?: T | undefined`，与本仓库启用的
 * exactOptionalPropertyTypes 不兼容；该边界先完成官方 Schema 校验，再收窄为官方 Event 类型。
 */
export const agUiEventSchema: { parse(value: unknown): AgUiEvent } = {
  parse(value) {
    return EventSchema.parse(value) as unknown as AgUiEvent;
  },
};

/** 使用官方 AG-UI Schema 校验标准 Agent 运行输入。 */
export function parseAgUiRunAgentInput(value: unknown): AgUiRunAgentInput {
  return RunAgentInputSchema.parse(value) as unknown as AgUiRunAgentInput;
}

/** 投影纯函数的状态：跨 message.delta 合并 TEXT_MESSAGE_* 生命周期。 */
export interface AgUiProjectionState {
  readonly textMessageOpen: boolean;
  readonly textMessageId?: string;
}

export const initialAgUiProjectionState: AgUiProjectionState = {
  textMessageOpen: false,
};

export interface AgUiProjectionResult {
  readonly events: readonly AgUiEvent[];
  readonly state: AgUiProjectionState;
}
