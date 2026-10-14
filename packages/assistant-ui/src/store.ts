import { assistantViewSchema } from "@assistant/contracts";

import type { ChatAction, ChatState, PublicExecutionStep } from "./types.js";

function eventString(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export const initialChatState: ChatState = {
  messages: [],
  steps: [],
  seenEventIds: new Set(),
  activeRunId: undefined,
};

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
      messages: [...state.messages, action.user, action.assistant],
      steps: [{ key: "run", title: "正在分析请求", status: "loading" }],
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
      })),
      steps: upsertStep(state.steps, {
        key: "run",
        title: "执行失败",
        detail: action.message,
        status: "error",
      }),
    };
  if (action.type === "cancelled")
    return {
      ...state,
      activeRunId: undefined,
      messages: updateLastAssistant(state, (message) => ({ ...message, status: "abort" })),
      steps: upsertStep(state.steps, { key: "run", title: "已取消", status: "error" }),
    };

  const { event } = action;
  if (state.seenEventIds.has(event.eventId)) return state;
  const seenEventIds = new Set(state.seenEventIds).add(event.eventId);
  let messages = state.messages;
  let steps = state.steps;
  let activeRunId = state.activeRunId;
  if (event.type === "message.delta") {
    const delta = typeof event.data["delta"] === "string" ? event.data["delta"] : "";
    messages = updateLastAssistant(state, (message) => ({
      ...message,
      content: message.content + delta,
    }));
  }
  if (event.type === "tool.started") {
    const callId = eventString(event.data["toolCallId"], String(event.sequence));
    steps = upsertStep(steps, {
      key: `tool:${callId}`,
      title: `调用业务能力：${eventString(event.data["toolName"], "unknown")}`,
      status: "loading",
    });
  }
  if (event.type === "tool.completed" || event.type === "tool.failed") {
    const callId = eventString(event.data["toolCallId"], String(event.sequence));
    steps = upsertStep(steps, {
      key: `tool:${callId}`,
      title: `业务能力：${eventString(event.data["toolName"], "unknown")}`,
      status: event.type === "tool.completed" ? "success" : "error",
    });
  }
  if (event.type === "subagent.started" || event.type === "subagent.completed") {
    const namespace = eventString(event.data["namespace"], "subagent");
    steps = upsertStep(steps, {
      key: `subagent:${namespace}`,
      title: "协作智能体",
      detail: namespace,
      status: event.type === "subagent.completed" ? "success" : "loading",
    });
  }
  if (event.type === "evidence.added") {
    const referenceId = event.data["referenceId"];
    if (typeof referenceId === "string")
      messages = updateLastAssistant({ ...state, messages }, (message) => ({
        ...message,
        evidenceIds: message.evidenceIds.includes(referenceId)
          ? message.evidenceIds
          : [...message.evidenceIds, referenceId],
      }));
  }
  if (event.type === "view.created") {
    const parsed = assistantViewSchema.safeParse(event.data);
    if (parsed.success)
      messages = updateLastAssistant({ ...state, messages }, (message) => ({
        ...message,
        views: [...message.views, parsed.data],
      }));
  }
  if (["run.completed", "run.failed", "run.cancelled"].includes(event.type)) {
    const status =
      event.type === "run.completed"
        ? "success"
        : event.type === "run.cancelled"
          ? "abort"
          : "error";
    messages = updateLastAssistant({ ...state, messages }, (message) => ({ ...message, status }));
    steps = upsertStep(steps, {
      key: "run",
      title:
        event.type === "run.completed"
          ? "分析完成"
          : event.type === "run.cancelled"
            ? "已取消"
            : "执行失败",
      status: event.type === "run.completed" ? "success" : "error",
    });
    activeRunId = undefined;
  }
  return { messages, steps, seenEventIds, activeRunId };
}
