import assert from "node:assert/strict";
import test from "node:test";

import {
  initialAgUiProjectionState,
  projectAssistantEventToAgUi,
} from "../../packages/contracts/dist/index.js";
import { chatReducer, initialChatState } from "../../packages/assistant-ui/dist/chat/store.js";

const sessionId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

function assistantEvent(sequence, type, data = {}) {
  return {
    schemaVersion: "1",
    eventId: `chat-event-${sequence}`,
    sequence,
    sessionId,
    runId,
    timestamp: `2026-10-21T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    type,
    data,
  };
}

function submittedState() {
  return chatReducer(initialChatState, {
    type: "submit",
    runId,
    user: {
      id: "user-message",
      role: "user",
      content: "检查质量趋势",
      status: "success",
      executionSteps: [],
      evidenceIds: [],
      views: [],
      approvals: [],
    },
    assistant: {
      id: "assistant-message",
      role: "assistant",
      content: "",
      status: "loading",
      executionSteps: [],
      evidenceIds: [],
      views: [],
      approvals: [],
    },
  });
}

function reduceSourceEvents(sourceEvents) {
  let projectionState = initialAgUiProjectionState;
  let chatState = submittedState();
  for (const sourceEvent of sourceEvents) {
    const projected = projectAssistantEventToAgUi(sourceEvent, projectionState);
    projectionState = projected.state;
    for (const event of projected.events)
      chatState = chatReducer(chatState, { type: "event", event });
  }
  return chatState;
}

test("reduces AG-UI text, tools, subagents, evidence, views, and completion", () => {
  const state = reduceSourceEvents([
    assistantEvent(1, "run.started"),
    assistantEvent(2, "message.delta", { delta: "当前质量分为 96%。" }),
    assistantEvent(3, "tool.started", {
      toolCallId: "tool-1",
      toolName: "data_quality_get_trend",
    }),
    assistantEvent(4, "tool.completed", {
      toolCallId: "tool-1",
      toolName: "data_quality_get_trend",
      rawResult: { secret: "must-not-render" },
    }),
    assistantEvent(5, "subagent.started", { namespace: "quality-analyst" }),
    assistantEvent(6, "subagent.completed", { namespace: "quality-analyst" }),
    assistantEvent(7, "evidence.added", {
      referenceId: "evidence-1",
      sourceType: "business-api",
    }),
    assistantEvent(8, "view.created", {
      viewId: "33333333-3333-4333-8333-333333333333",
      viewType: "metric",
      schemaVersion: "1",
      title: "质量分",
      data: { label: "得分", value: 96, unit: "%" },
      evidenceIds: ["evidence-1"],
    }),
    assistantEvent(9, "run.completed"),
  ]);

  const assistant = state.messages.at(-1);
  assert.equal(assistant.content, "当前质量分为 96%。");
  assert.equal(assistant.status, "success");
  assert.deepEqual(assistant.evidenceIds, ["evidence-1"]);
  assert.equal(assistant.views.length, 1);
  assert.equal(
    assistant.executionSteps.find((step) => step.key === "tool:tool-1").status,
    "success",
  );
  assert.equal(
    assistant.executionSteps.find((step) => step.key === "subagent:quality-analyst").status,
    "success",
  );
  assert.equal(JSON.stringify(state).includes("must-not-render"), false);
  assert.equal(state.activeRunId, undefined);
});

test("deduplicates projected AG-UI events by the enterprise projection cursor", () => {
  const projected = projectAssistantEventToAgUi(
    assistantEvent(10, "message.delta", { delta: "只追加一次" }),
  );
  let state = submittedState();
  for (const event of projected.events) state = chatReducer(state, { type: "event", event });
  for (const event of projected.events) state = chatReducer(state, { type: "event", event });

  assert.equal(state.messages.at(-1).content, "只追加一次");
  assert.equal(state.seenEventIds.size, 2);
});

test("maps AG-UI cancellation and failure to terminal chat states", () => {
  const cancelled = reduceSourceEvents([assistantEvent(11, "run.cancelled")]);
  assert.equal(cancelled.messages.at(-1).status, "abort");
  assert.equal(cancelled.activeRunId, undefined);

  const failed = reduceSourceEvents([
    assistantEvent(12, "run.failed", { code: "UPSTREAM_TIMEOUT", message: "Timed out" }),
  ]);
  assert.equal(failed.messages.at(-1).status, "error");
  assert.equal(failed.messages.at(-1).content, "Agent 执行失败，请重试。");
  assert.equal(failed.messages.at(-1).executionSteps.at(-1).detail, "UPSTREAM_TIMEOUT");
  assert.equal(failed.activeRunId, undefined);
});

test("public business rejection survives the resumed-run failure fallback", () => {
  let state = reduceSourceEvents([
    assistantEvent(15, "run.failed", {
      code: "MCP_BUSINESS_REJECTED",
      message: "请先解除关联后再删除。",
    }),
  ]);
  state = chatReducer(state, { type: "failed", message: "Agent 恢复执行失败，请重试。" });
  assert.equal(state.messages.at(-1).content, "请先解除关联后再删除。");
  assert.equal(
    state.messages.at(-1).executionSteps.find((step) => step.key === "run").detail,
    "请先解除关联后再删除。",
  );
});

test("renders a standard AG-UI interrupt and prepares the resumed run", () => {
  let state = reduceSourceEvents([
    assistantEvent(13, "message.delta", { delta: "发布前需要你的确认。" }),
    assistantEvent(14, "approval.required", {
      id: "approve-publish-orders",
      reason: "business_write",
      message: "确认发布订单质量报告吗？",
    }),
    assistantEvent(15, "run.interrupted", {
      interrupts: [
        {
          id: "approve-publish-orders",
          reason: "business_write",
          message: "确认发布订单质量报告吗？",
        },
      ],
    }),
  ]);

  assert.equal(state.activeRunId, undefined);
  assert.equal(state.messages.at(-1).approvals[0].status, "pending");
  assert.equal(state.messages.at(-1).approvals[0].runId, runId);
  assert.equal(state.messages.at(-1).executionSteps.at(-1).title, "等待你的确认");

  state = chatReducer(state, {
    type: "resume-bound",
    interruptId: "approve-publish-orders",
    decision: "approved",
    runId: "33333333-3333-4333-8333-333333333333",
    assistant: {
      id: "assistant-resumed",
      role: "assistant",
      content: "",
      status: "loading",
      executionSteps: [],
      evidenceIds: [],
      views: [],
      approvals: [],
    },
  });
  assert.equal(state.messages.at(-2).approvals[0].status, "approved");
  assert.equal(state.messages.at(-1).executionSteps[0].title, "正在继续执行");
  assert.equal(state.activeRunId, "33333333-3333-4333-8333-333333333333");
});
