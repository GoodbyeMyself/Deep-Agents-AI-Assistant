import assert from "node:assert/strict";
import test from "node:test";

import {
  createApiHandler,
  InMemoryAgentStore,
  ServiceError,
} from "../../apps/agent-server/dist/index.js";
import {
  AgUiChatAgentPort,
  AssistantApiTransport,
} from "../../packages/assistant-transport/dist/index.js";

const principalA = {
  id: "user-a",
  displayName: "User A",
  tenantId: "tenant-a",
  permissionScopes: ["data_quality:read"],
  authorizedObjectIds: ["orders"],
  authorizationRef: "mock-auth:user-a",
};

const principalB = {
  id: "user-b",
  displayName: "User B",
  tenantId: "tenant-a",
  permissionScopes: ["data_quality:read"],
  authorizedObjectIds: ["orders"],
  authorizationRef: "mock-auth:user-b",
};

function createFixture() {
  const store = new InMemoryAgentStore();
  const session = store.createSession(principalA, "standalone", "AG-UI test");
  const contextSnapshotId = "11111111-1111-4111-8111-111111111111";
  store.saveSnapshot({
    id: contextSnapshotId,
    version: 1,
    ownerId: principalA.id,
    tenantId: principalA.tenantId,
    mode: "standalone",
    capturedAt: "2026-10-20T00:00:00.000Z",
    context: {
      user: { id: principalA.id, displayName: principalA.displayName },
      permissions: { scopes: [...principalA.permissionScopes] },
      object: { type: "table", id: "orders", name: "Orders" },
    },
  });
  const { run } = store.createRun({
    principal: principalA,
    sessionId: session.id,
    contextSnapshotId,
    clientRequestId: "ag-ui-endpoint-test",
    message: "Show quality trend",
  });
  store.setRunStatus(run.id, "running");
  store.appendEvent(run.id, "run.started", { modelConfigVersion: "mock@1" });
  store.appendEvent(run.id, "message.delta", { delta: "Quality is stable." });
  store.appendEvent(run.id, "tool.started", {
    toolCallId: "tool-call-1",
    toolName: "data_quality_get_trend",
  });
  store.appendEvent(run.id, "tool.completed", {
    toolCallId: "tool-call-1",
    toolName: "data_quality_get_trend",
    rawResult: { customerEmail: "secret@example.com" },
  });
  store.appendEvent(run.id, "run.completed", { evidenceRefs: [] });
  store.setRunStatus(run.id, "completed");

  const identity = {
    authenticate(authorization) {
      if (authorization === "Bearer token-a") return Promise.resolve(principalA);
      if (authorization === "Bearer token-b") return Promise.resolve(principalB);
      return Promise.reject(
        new ServiceError("UNAUTHENTICATED", "Authentication required.", 401),
      );
    },
  };
  const service = {
    store,
    runner: { cancel() {} },
    runtimeInfo: { models: [], mcpServers: [], mcpTools: [] },
  };
  const handler = createApiHandler({ identity, service });
  return { handler, run };
}

function request(handler, runId, token, lastEventId) {
  return handler(
    new Request(`http://localhost/api/v1/runs/${runId}/ag-ui/events`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
        ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
      },
    }),
  );
}

function parseFrames(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter((frame) => frame.length > 0)
    .map((frame) => {
      const lines = frame.split(/\r?\n/);
      const id = lines.find((line) => line.startsWith("id: "))?.slice(4);
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
      assert.ok(id);
      assert.ok(event);
      assert.ok(data);
      return { id, event, data: JSON.parse(data) };
    });
}

test("streams AG-UI events from the existing authorized run log", async () => {
  const { handler, run } = createFixture();
  const response = await request(handler, run.id, "token-a");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");

  const body = await response.text();
  const frames = parseFrames(body);
  assert.deepEqual(
    frames.map((frame) => frame.event),
    [
      "RUN_STARTED",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TOOL_CALL_START",
      "TOOL_CALL_END",
      "TOOL_CALL_RESULT",
      "TEXT_MESSAGE_END",
      "RUN_FINISHED",
    ],
  );
  assert.equal(body.includes("secret@example.com"), false);
  assert.equal(body.includes(principalA.authorizationRef), false);
});

test("resumes after an individual projected event without skipping its sibling", async () => {
  const { handler, run } = createFixture();
  const initial = parseFrames(await (await request(handler, run.id, "token-a")).text());
  const startCursor = initial.find((frame) => frame.event === "TEXT_MESSAGE_START")?.id;
  assert.ok(startCursor);

  const resumed = parseFrames(
    await (await request(handler, run.id, "token-a", startCursor)).text(),
  );
  assert.equal(resumed[0]?.event, "TEXT_MESSAGE_CONTENT");
  assert.equal(resumed.at(-1)?.event, "RUN_FINISHED");
  assert.equal(resumed.some((frame) => frame.event === "TEXT_MESSAGE_START"), false);
});

test("rejects malformed cursors and runs owned by another principal", async () => {
  const { handler, run } = createFixture();
  const invalidCursor = await request(handler, run.id, "token-a", "not-an-ag-ui-cursor");
  assert.equal(invalidCursor.status, 409);
  assert.equal((await invalidCursor.json()).code, "EVENT_CURSOR_EXPIRED");

  const crossUser = await request(handler, run.id, "token-b");
  assert.equal(crossUser.status, 404);
  assert.equal((await crossUser.json()).code, "NOT_FOUND");
});

test("requires authentication before reading the AG-UI event stream", async () => {
  const { handler, run } = createFixture();
  const response = await handler(
    new Request(`http://localhost/api/v1/runs/${run.id}/ag-ui/events`, {
      headers: { accept: "text/event-stream" },
    }),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});

test("AgUiChatAgentPort consumes the authenticated AG-UI endpoint", async () => {
  const { handler, run } = createFixture();
  const transport = new AssistantApiTransport({
    apiBaseUrl: "http://localhost/api/v1",
    getAccessCredential: () => "token-a",
    fetchImpl: (input, init) => handler(new Request(input, init)),
  });
  const port = new AgUiChatAgentPort(transport);
  const events = [];
  for await (const event of port.watchRun(run.id)) events.push(event);

  assert.equal(events[0]?.type, "RUN_STARTED");
  assert.equal(events.at(-1)?.type, "RUN_FINISHED");
});
