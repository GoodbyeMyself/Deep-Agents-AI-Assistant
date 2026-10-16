import type { AssistantEvent } from "@assistant/contracts";
import { describe, expect, it } from "vitest";

import { chatReducer, initialChatState } from "./store.js";

const assistant = {
  id: "a",
  role: "assistant" as const,
  content: "",
  status: "loading" as const,
  executionSteps: [],
  evidenceIds: [],
  views: [],
};
const user = {
  id: "u",
  role: "user" as const,
  content: "hello",
  status: "success" as const,
  executionSteps: [],
  evidenceIds: [],
  views: [],
};
const baseEvent: AssistantEvent = {
  schemaVersion: "1",
  eventId: "e1",
  sequence: 1,
  sessionId: "3cf147c3-3b30-4586-bdb3-b7f49b846ce4",
  runId: "d66e4139-053b-43d4-a104-fc0291fb5959",
  timestamp: "2026-10-14T08:00:00.000Z",
  type: "message.delta",
  data: { delta: "结果" },
};

describe("chatReducer", () => {
  it("applies streaming text exactly once", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const once = chatReducer(submitted, { type: "event", event: baseEvent });
    const twice = chatReducer(once, { type: "event", event: baseEvent });
    expect(twice.messages[1]?.content).toBe("结果");
  });

  it("isolates session messages on reset", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const reset = chatReducer(submitted, { type: "reset", messages: [] });
    expect(reset.messages).toEqual([]);
    expect(reset.seenEventIds.size).toBe(0);
  });

  it("preserves a partial answer and marks it failed", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const partial = chatReducer(submitted, { type: "event", event: baseEvent });
    const failed = chatReducer(partial, { type: "failed", message: "network interrupted" });
    expect(failed.messages[1]).toMatchObject({ content: "结果", status: "error" });
  });

  it("attaches public execution steps to the matching assistant message", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const toolStarted = chatReducer(submitted, {
      type: "event",
      event: {
        ...baseEvent,
        eventId: "tool-started",
        type: "tool.started",
        data: {
          toolCallId: "private-call-id",
          toolName: "data_quality_get_trend",
        },
      },
    });
    const assistantMessage = toolStarted.messages[1];

    expect(assistantMessage?.executionSteps).toEqual([
      { key: "run", title: "正在分析请求", status: "loading" },
      {
        key: "tool:private-call-id",
        title: "查询数据质量趋势",
        detail: "业务能力 · data_quality_get_trend",
        status: "loading",
      },
    ]);
  });

  it("retains the public subagent namespace as execution detail", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const started = chatReducer(submitted, {
      type: "event",
      event: {
        ...baseEvent,
        eventId: "subagent-started",
        type: "subagent.started",
        data: { namespace: "tools:02c1f3dd-77d6-5667-995d-41c76be1f8c3" },
      },
    });

    expect(started.messages[1]?.executionSteps.at(-1)).toMatchObject({
      title: "协作智能体处理",
      detail: "tools:02c1f3dd-77d6-5667-995d-41c76be1f8c3",
    });
  });

  it("does not overwrite execution steps on an earlier assistant message", () => {
    const first = chatReducer(initialChatState, { type: "submit", user, assistant });
    const second = chatReducer(first, {
      type: "submit",
      user: { ...user, id: "u2" },
      assistant: { ...assistant, id: "a2" },
    });

    expect(second.messages[1]?.executionSteps).toEqual(first.messages[1]?.executionSteps);
    expect(second.messages[3]?.executionSteps).toEqual([
      { key: "run", title: "正在分析请求", status: "loading" },
    ]);
  });

  it("produces the same product-agnostic view model for normalized A/B events", () => {
    const build = () => {
      const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
      return chatReducer(submitted, { type: "event", event: baseEvent }).messages;
    };
    expect(build()).toEqual(build());
  });
});
