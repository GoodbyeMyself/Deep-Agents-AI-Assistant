import { EventType, PROTOCOL_VERSION, type Event, type RunAgentInput } from "@ag-ui/core";
import { EventSchema, RunAgentInputSchema } from "@ag-ui/core/schemas";
import { z } from "zod";

import type { AssistantEvent } from "./index.js";
import { runInterruptedDataSchema } from "./interrupts.js";
import { assistantViewSchema } from "./views.js";

export { EventType } from "@ag-ui/core";
export type { Interrupt as AgUiInterrupt, ResumeEntry as AgUiResumeEntry } from "@ag-ui/core";

export const ENTERPRISE_ASSISTANT_METADATA_KEY = "enterprise-assistant";
export const AG_UI_PROTOCOL_VERSION = PROTOCOL_VERSION;
export const EVIDENCE_ADDED_EVENT_NAME = "enterprise.evidence.added.v1";
export const VIEW_CREATED_EVENT_NAME = "enterprise.view.created.v1";
const AG_UI_CURSOR_PREFIX = "agui1.";

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

export class AssistantEventProjectionError extends Error {
  constructor(
    readonly eventType: AssistantEvent["type"],
    readonly field: string,
  ) {
    super(`Cannot project ${eventType}: invalid ${field}.`);
  }
}

export interface AgUiEventCursor {
  readonly sourceEventId: string;
  readonly projectionIndex: number;
}

export function encodeAgUiEventCursor(cursor: AgUiEventCursor): string {
  if (cursor.sourceEventId.length === 0 || !Number.isSafeInteger(cursor.projectionIndex))
    throw new Error("Invalid AG-UI event cursor.");
  if (cursor.projectionIndex < 0) throw new Error("Invalid AG-UI event cursor.");
  return `${AG_UI_CURSOR_PREFIX}${encodeURIComponent(cursor.sourceEventId)}.${cursor.projectionIndex}`;
}

export function decodeAgUiEventCursor(value: string): AgUiEventCursor | undefined {
  if (!value.startsWith(AG_UI_CURSOR_PREFIX)) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator <= AG_UI_CURSOR_PREFIX.length) return undefined;
  const projectionIndex = Number(value.slice(separator + 1));
  if (!Number.isSafeInteger(projectionIndex) || projectionIndex < 0) return undefined;
  try {
    const sourceEventId = decodeURIComponent(
      value.slice(AG_UI_CURSOR_PREFIX.length, separator),
    );
    return sourceEventId.length === 0 ? undefined : { sourceEventId, projectionIndex };
  } catch {
    return undefined;
  }
}

export function getAgUiEventCursor(event: AgUiEvent): string {
  const metadata = (event.metadata as Record<string, unknown> | undefined)?.[
    ENTERPRISE_ASSISTANT_METADATA_KEY
  ];
  const parsed = enterpriseAssistantMetadataSchema.safeParse(metadata);
  if (!parsed.success) throw new Error("AG-UI event is missing enterprise cursor metadata.");
  return parsed.data.eventId;
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
