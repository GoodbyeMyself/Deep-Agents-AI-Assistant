import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_ADDED_EVENT_NAME,
  ENTERPRISE_ASSISTANT_METADATA_KEY,
  VIEW_CREATED_EVENT_NAME,
  agUiEventSchema,
  initialAgUiProjectionState,
  projectAssistantEventToAgUi,
} from "../../packages/contracts/dist/index.js";

const sessionId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

function assistantEvent(sequence, type, data = {}) {
  return {
    schemaVersion: "1",
    eventId: `event-${sequence}`,
    sequence,
    sessionId,
    runId,
    timestamp: `2026-10-20T00:00:${String(sequence).padStart(2, "0")}.000Z`,
    type,
    data,
  };
}

function project(event, state = initialAgUiProjectionState) {
  return projectAssistantEventToAgUi(event, state);
}

test("projects a replayable text run into a valid AG-UI lifecycle", () => {
  const started = project(assistantEvent(1, "run.started"));
  assert.deepEqual(
    started.events.map((event) => event.type),
    ["RUN_STARTED"],
  );
  assert.equal(started.events[0].protocolVersion, "1.0");

  const firstDelta = project(
    assistantEvent(2, "message.delta", { delta: "Hello" }),
    started.state,
  );
  assert.deepEqual(
    firstDelta.events.map((event) => event.type),
    ["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT"],
  );

  const secondDelta = project(
    assistantEvent(3, "message.delta", { delta: " world" }),
    firstDelta.state,
  );
  assert.deepEqual(
    secondDelta.events.map((event) => event.type),
    ["TEXT_MESSAGE_CONTENT"],
  );

  const completed = project(assistantEvent(4, "run.completed"), secondDelta.state);
  assert.deepEqual(
    completed.events.map((event) => event.type),
    ["TEXT_MESSAGE_END", "RUN_FINISHED"],
  );
  assert.deepEqual(completed.events[1].outcome, { type: "success" });

  for (const event of [
    ...started.events,
    ...firstDelta.events,
    ...secondDelta.events,
    ...completed.events,
  ])
    assert.deepEqual(agUiEventSchema.parse(event), event);

  const projectedIds = firstDelta.events.map(
    (event) => event.metadata[ENTERPRISE_ASSISTANT_METADATA_KEY].eventId,
  );
  assert.deepEqual(projectedIds, ["event-2:1", "event-2:2"]);
});

test("projects tool status without exposing arguments or raw business results", () => {
  const started = project(
    assistantEvent(5, "tool.started", {
      toolCallId: "tool-call-1",
      toolName: "data_quality_get_trend",
    }),
  );
  const completed = project(
    assistantEvent(6, "tool.completed", {
      toolCallId: "tool-call-1",
      toolName: "data_quality_get_trend",
      rawResult: { customerEmail: "secret@example.com" },
    }),
    started.state,
  );

  assert.deepEqual(
    completed.events.map((event) => event.type),
    ["TOOL_CALL_END", "TOOL_CALL_RESULT"],
  );
  assert.equal(completed.events[1].content, '{"status":"completed"}');
  assert.equal(JSON.stringify(completed.events).includes("secret@example.com"), false);
});

test("uses validated enterprise custom events for evidence and controlled views", () => {
  const evidence = project(
    assistantEvent(7, "evidence.added", {
      referenceId: "evidence-1",
      sourceType: "business-api",
    }),
  );
  assert.equal(evidence.events[0].type, "CUSTOM");
  assert.equal(evidence.events[0].name, EVIDENCE_ADDED_EVENT_NAME);

  const view = project(
    assistantEvent(8, "view.created", {
      viewId: "33333333-3333-4333-8333-333333333333",
      viewType: "metric",
      schemaVersion: "1",
      title: "Quality score",
      data: { label: "Score", value: 98, unit: "%" },
      evidenceIds: ["evidence-1"],
    }),
  );
  assert.equal(view.events[0].type, "CUSTOM");
  assert.equal(view.events[0].name, VIEW_CREATED_EVENT_NAME);

  assert.throws(() =>
    project(
      assistantEvent(9, "evidence.added", {
        referenceId: "evidence-1",
        authorizationRef: "must-not-cross-the-wire",
      }),
    ),
  );
});

test("maps cancellation to the AG-UI cancelled outcome", () => {
  const result = project(assistantEvent(10, "run.cancelled"));
  assert.equal(result.events[0].type, "RUN_FINISHED");
  assert.deepEqual(result.events[0].outcome, { type: "cancelled" });
});

test("produces the same AG-UI projection when a stored event is replayed", () => {
  const source = assistantEvent(11, "message.delta", { delta: "deterministic" });
  assert.deepEqual(project(source), project(source));
});
