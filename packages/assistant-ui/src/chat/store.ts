import {
  EVIDENCE_ADDED_EVENT_NAME,
  EventType,
  VIEW_CREATED_EVENT_NAME,
  assistantViewSchema,
  enterpriseAssistantCustomEventSchema,
  getAgUiEventCursor,
} from "@assistant/contracts";

import type { ChatAction, ChatState, PublicExecutionStep } from "./types.js";

export const initialChatState: ChatState = {
  messages: [],
  seenEventIds: new Set(),
  activeRunId: undefined,
};

const publicToolLabels: Readonly<Record<string, string>> = {
  data_map_search_objects: "搜索业务数据对象",
  data_quality_get_trend: "查询数据质量趋势",
};

function publicToolStep(value: unknown): Pick<PublicExecutionStep, "title" | "detail"> {
  const toolName = typeof value === "string" ? value : "";
  return {
    title: publicToolLabels[toolName] ?? "调用受控业务能力",
    ...(toolName ? { detail: `业务能力 · ${toolName}` } : {}),
  };
}

function toolResultStatus(content: unknown): "success" | "error" {
  if (typeof content !== "string") return "error";
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "error";
    return (parsed as Record<string, unknown>)["status"] === "completed" ? "success" : "error";
  } catch {
    return "error";
  }
}

function updateLastAssistant(
  state: ChatState,
  update: (message: ChatState["messages"][number]) => ChatState["messages"][number],
): ChatState["messages"] {
  const index = state.messages.findLastIndex((message) => message.role === "assistant");
  if (index < 0) return state.messages;
  return state.messages.map((message, current) => (current === index ? update(message) : message));
}

function upsertStep(
  steps: PublicExecutionStep[],
  step: PublicExecutionStep,
): PublicExecutionStep[] {
  const index = steps.findIndex((item) => item.key === step.key);
  return index < 0
    ? [...steps, step]
    : steps.map((item, current) => (current === index ? { ...item, ...step } : item));
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") return { ...initialChatState, messages: action.messages };
  if (action.type === "submit")
    return {
      messages: [
        ...state.messages,
        action.user,
        {
          ...action.assistant,
          executionSteps: [{ key: "run", title: "正在分析请求", status: "loading" }],
        },
      ],
      seenEventIds: new Set(),
      activeRunId: action.runId,
    };
  if (action.type === "run-bound") return { ...state, activeRunId: action.runId };
  if (action.type === "failed")
    return {
      ...state,
      activeRunId: undefined,
      messages: updateLastAssistant(state, (message) => ({
        ...message,
        content: message.content || action.message,
        status: "error",
        executionSteps: upsertStep(message.executionSteps, {
          key: "run",
          title: "执行失败",
          detail: action.message,
          status: "error",
        }),
      })),
    };
  if (action.type === "cancelled")
    return {
      ...state,
      activeRunId: undefined,
      messages: updateLastAssistant(state, (message) => ({
        ...message,
        status: "abort",
        executionSteps: upsertStep(message.executionSteps, {
          key: "run",
          title: "已取消",
          status: "error",
        }),
      })),
    };

  const { event } = action;
  const eventId = getAgUiEventCursor(event);
  if (state.seenEventIds.has(eventId)) return state;
  const seenEventIds = new Set(state.seenEventIds).add(eventId);
  let messages = state.messages;
  let activeRunId = state.activeRunId;
  if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
    messages = updateLastAssistant(state, (message) => ({
      ...message,
      content: message.content + event.delta,
    }));
  }
  if (event.type === EventType.TOOL_CALL_START) {
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      executionSteps: upsertStep(message.executionSteps, {
        key: `tool:${event.toolCallId}`,
        ...publicToolStep(event.toolCallName),
        status: "loading",
      }),
    }));
  }
  if (event.type === EventType.TOOL_CALL_RESULT) {
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      executionSteps: upsertStep(message.executionSteps, {
        key: `tool:${event.toolCallId}`,
        title:
          message.executionSteps.find((step) => step.key === `tool:${event.toolCallId}`)?.title ??
          "调用受控业务能力",
        status: toolResultStatus(event.content),
      }),
    }));
  }
  if (event.type === EventType.SUBAGENT_STARTED) {
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      executionSteps: upsertStep(message.executionSteps, {
        key: `subagent:${event.subagentRunId}`,
        title: "协作智能体处理",
        detail: event.name,
        status: "loading",
      }),
    }));
  }
  if (event.type === EventType.SUBAGENT_FINISHED) {
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      executionSteps: upsertStep(message.executionSteps, {
        key: `subagent:${event.subagentRunId}`,
        title: "协作智能体处理",
        detail: event.subagentRunId,
        status: event.outcome?.type === "suspended" ? "loading" : "success",
      }),
    }));
  }
  if (event.type === EventType.CUSTOM) {
    const parsed = enterpriseAssistantCustomEventSchema.safeParse({
      type: event.type,
      name: event.name,
      value: event.value,
    });
    if (parsed.success && parsed.data.name === EVIDENCE_ADDED_EVENT_NAME) {
      const { referenceId } = parsed.data.value;
      messages = updateLastAssistant({ ...state, messages }, (message) => ({
        ...message,
        evidenceIds: message.evidenceIds.includes(referenceId)
          ? message.evidenceIds
          : [...message.evidenceIds, referenceId],
      }));
    }
    if (parsed.success && parsed.data.name === VIEW_CREATED_EVENT_NAME) {
      const view = assistantViewSchema.parse(parsed.data.value);
      messages = updateLastAssistant({ ...state, messages }, (message) => ({
        ...message,
        views: [...message.views, view],
      }));
    }
  }
  if (event.type === EventType.RUN_FINISHED) {
    const cancelled = event.outcome?.type === "cancelled";
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      status: cancelled ? "abort" : "success",
      executionSteps: upsertStep(message.executionSteps, {
        key: "run",
        title: cancelled ? "已取消" : "分析完成",
        status: cancelled ? "error" : "success",
      }),
    }));
    activeRunId = undefined;
  }
  if (event.type === EventType.RUN_ERROR) {
    messages = updateLastAssistant({ ...state, messages }, (message) => ({
      ...message,
      content: message.content || "Agent 执行失败，请重试。",
      status: "error",
      executionSteps: upsertStep(message.executionSteps, {
        key: "run",
        title: "执行失败",
        ...(event.code === undefined ? {} : { detail: event.code }),
        status: "error",
      }),
    }));
    activeRunId = undefined;
  }
  return { messages, seenEventIds, activeRunId };
}
