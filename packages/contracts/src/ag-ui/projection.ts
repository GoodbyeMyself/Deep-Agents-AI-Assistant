/**
 * 将已持久化的 AssistantEvent 序列确定性映射为 AG-UI 1.0 事件流。
 *
 * 输入必须是服务端已授权、已校验的事件；不在此接受客户端 Context 或 Tool 执行结果。
 * 每条输出经 addEnterpriseEnvelope 附加 metadata 并通过官方 EventSchema 复验。
 */
import { EventType, PROTOCOL_VERSION, type Event } from "@ag-ui/core";
import { EventSchema } from "@ag-ui/core/schemas";

import { runInterruptedDataSchema } from "../governance/interrupts.js";
import type { AssistantEvent } from "../sse/assistant-events.js";
import { assistantViewSchema } from "../ui/views.js";
import { encodeAgUiEventCursor } from "./cursor.js";
import {
  ENTERPRISE_ASSISTANT_METADATA_KEY,
  EVIDENCE_ADDED_EVENT_NAME,
  enterpriseAssistantCustomEventSchema,
  enterpriseAssistantMetadataSchema,
  enterpriseEvidenceAddedValueSchema,
  initialAgUiProjectionState,
  VIEW_CREATED_EVENT_NAME,
  type AgUiEvent,
  type AgUiProjectionResult,
  type AgUiProjectionState,
} from "./schemas.js";

export class AssistantEventProjectionError extends Error {
  constructor(
    readonly eventType: AssistantEvent["type"],
    readonly field: string,
  ) {
    super(`Cannot project ${eventType}: invalid ${field}.`);
  }
}

function requiredString(event: AssistantEvent, field: string): string {
  const value = event.data[field];
  if (typeof value !== "string" || value.length === 0)
    throw new AssistantEventProjectionError(event.type, field);
  return value;
}

function eventTimestamp(event: AssistantEvent): number {
  const timestamp = Date.parse(event.timestamp);
  if (!Number.isSafeInteger(timestamp))
    throw new AssistantEventProjectionError(event.type, "timestamp");
  return timestamp;
}

function messageId(event: AssistantEvent, state: AgUiProjectionState): string {
  return state.textMessageId ?? `${event.runId}:assistant`;
}

function closeTextMessage(
  event: AssistantEvent,
  state: AgUiProjectionState,
): { readonly events: readonly Event[]; readonly state: AgUiProjectionState } {
  if (!state.textMessageOpen) return { events: [], state };
  const currentMessageId = messageId(event, state);
  return {
    events: [{ type: EventType.TEXT_MESSAGE_END, messageId: currentMessageId }],
    state: { textMessageId: currentMessageId, textMessageOpen: false },
  };
}

/** 为候选 AG-UI 事件注入企业 metadata 与稳定游标 eventId。 */
function addEnterpriseEnvelope(
  source: AssistantEvent,
  candidate: Event,
  projectionIndex: number,
): AgUiEvent {
  const eventId =
    encodeAgUiEventCursor({ sourceEventId: source.eventId, projectionIndex });
  const event: Event = {
    ...candidate,
    timestamp: eventTimestamp(source),
    metadata: {
      [ENTERPRISE_ASSISTANT_METADATA_KEY]: enterpriseAssistantMetadataSchema.parse({
        eventId,
        sourceEventId: source.eventId,
        projectionIndex,
        sequence: source.sequence,
        sessionId: source.sessionId,
        schemaVersion: source.schemaVersion,
      }),
    },
  };
  EventSchema.parse(event);
  return event;
}

function projectCandidates(
  source: AssistantEvent,
  candidates: readonly Event[],
  state: AgUiProjectionState,
): AgUiProjectionResult {
  return {
    events: candidates.map((candidate, index) =>
      addEnterpriseEnvelope(source, candidate, index),
    ),
    state,
  };
}

/**
 * 将现有可重放 AssistantEvent 确定性投影为 AG-UI 1.0 事件。
 *
 * 该函数不接受浏览器提供的身份、Tool 或授权 Context；这些边界仍由 Agent Gateway 管理。
 */
export function projectAssistantEventToAgUi(
  event: AssistantEvent,
  state: AgUiProjectionState = initialAgUiProjectionState,
): AgUiProjectionResult {
  const currentMessageId = messageId(event, state);

  switch (event.type) {
    case "run.started":
      return projectCandidates(
        event,
        [
          {
            type: EventType.RUN_STARTED,
            threadId: event.sessionId,
            runId: event.runId,
            protocolVersion: PROTOCOL_VERSION,
          },
        ],
        { textMessageId: currentMessageId, textMessageOpen: false },
      );

    case "message.delta": {
      const content: Event = {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: currentMessageId,
        delta: requiredString(event, "delta"),
      };
      const candidates: Event[] = state.textMessageOpen
        ? [content]
        : [
            {
              type: EventType.TEXT_MESSAGE_START,
              messageId: currentMessageId,
              role: "assistant",
            },
            content,
          ];
      return projectCandidates(event, candidates, {
        textMessageId: currentMessageId,
        textMessageOpen: true,
      });
    }

    case "tool.started":
      return projectCandidates(
        event,
        [
          {
            type: EventType.TOOL_CALL_START,
            toolCallId: requiredString(event, "toolCallId"),
            toolCallName: requiredString(event, "toolName"),
            parentMessageId: currentMessageId,
          },
        ],
        state,
      );

    case "tool.completed":
    case "tool.failed": {
      const toolCallId = requiredString(event, "toolCallId");
      const status = event.type === "tool.completed" ? "completed" : "failed";
      return projectCandidates(
        event,
        [
          { type: EventType.TOOL_CALL_END, toolCallId },
          {
            type: EventType.TOOL_CALL_RESULT,
            messageId: `${event.runId}:tool-result:${toolCallId}`,
            toolCallId,
            content: JSON.stringify({ status }),
            role: "tool",
          },
        ],
        state,
      );
    }

    case "evidence.added": {
      const value = enterpriseEvidenceAddedValueSchema.parse(event.data);
      const customEvent = enterpriseAssistantCustomEventSchema.parse({
        type: EventType.CUSTOM,
        name: EVIDENCE_ADDED_EVENT_NAME,
        value,
      }) as Event;
      return projectCandidates(event, [customEvent], state);
    }

    case "view.created": {
      const customEvent = enterpriseAssistantCustomEventSchema.parse({
        type: EventType.CUSTOM,
        name: VIEW_CREATED_EVENT_NAME,
        value: assistantViewSchema.parse(event.data),
      }) as Event;
      return projectCandidates(event, [customEvent], state);
    }

    case "subagent.started": {
      const namespace = requiredString(event, "namespace");
      return projectCandidates(
        event,
        [{ type: EventType.SUBAGENT_STARTED, subagentRunId: namespace, name: namespace }],
        state,
      );
    }

    case "subagent.completed":
      return projectCandidates(
        event,
        [
          {
            type: EventType.SUBAGENT_FINISHED,
            subagentRunId: requiredString(event, "namespace"),
            outcome: { type: "success" },
          },
        ],
        state,
      );

    // 审批 UI 由 assistant-ui 消费原生 SSE；AG-UI 流在此不产生额外事件，避免重复卡片。
    case "approval.required":
      return projectCandidates(event, [], state);

    case "run.interrupted": {
      const closed = closeTextMessage(event, state);
      const { interrupts } = runInterruptedDataSchema.parse(event.data);
      const publicInterrupts = interrupts.map((interrupt) => ({
        id: interrupt.id,
        reason: interrupt.reason,
        ...(interrupt.message === undefined ? {} : { message: interrupt.message }),
        ...(interrupt.toolCallId === undefined ? {} : { toolCallId: interrupt.toolCallId }),
        ...(interrupt.responseSchema === undefined
          ? {}
          : { responseSchema: interrupt.responseSchema }),
        ...(interrupt.expiresAt === undefined ? {} : { expiresAt: interrupt.expiresAt }),
      }));
      return projectCandidates(
        event,
        [
          ...closed.events,
          {
            type: EventType.RUN_FINISHED,
            threadId: event.sessionId,
            runId: event.runId,
            outcome: { type: "interrupt", interrupts: publicInterrupts },
          },
        ],
        closed.state,
      );
    }

    case "run.completed": {
      const closed = closeTextMessage(event, state);
      return projectCandidates(
        event,
        [
          ...closed.events,
          {
            type: EventType.RUN_FINISHED,
            threadId: event.sessionId,
            runId: event.runId,
            result: { status: "completed" },
            outcome: { type: "success" },
          },
        ],
        closed.state,
      );
    }

    case "run.cancelled": {
      const closed = closeTextMessage(event, state);
      return projectCandidates(
        event,
        [
          ...closed.events,
          {
            type: EventType.RUN_FINISHED,
            threadId: event.sessionId,
            runId: event.runId,
            outcome: { type: "cancelled" },
          },
        ],
        closed.state,
      );
    }

    case "run.failed": {
      const closed = closeTextMessage(event, state);
      return projectCandidates(
        event,
        [
          ...closed.events,
          {
            type: EventType.RUN_ERROR,
            message: requiredString(event, "message"),
            code: requiredString(event, "code"),
          },
        ],
        closed.state,
      );
    }
  }
}
