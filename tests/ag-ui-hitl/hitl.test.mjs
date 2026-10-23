import assert from "node:assert/strict";
import test from "node:test";

import { AIMessage } from "@langchain/core/messages";

import {
  AgentRunner,
  AgentService,
  InMemoryAgentStore,
  ServiceError,
  createApiHandler,
} from "../../apps/agent-server/dist/index.js";

const principalA = {
  id: "user-a",
  displayName: "User A",
  tenantId: "tenant-a",
  permissionScopes: ["data_quality:read"],
  authorizedObjectIds: ["orders"],
  authorizationRef: "mock-auth:user-a",
};

const principalB = {
  ...principalA,
  id: "user-b",
  displayName: "User B",
  authorizationRef: "mock-auth:user-b",
};

class InterruptingAgent {
  streamCount = 0;
  resumedValue;

  async stream(input) {
    this.streamCount += 1;
    if (this.streamCount > 1) this.resumedValue = input.resume;
    if (this.streamCount === 1) return (async function* emptyStream() {})();
    return (async function* resumedStream() {
      yield [[], [new AIMessage("订单质量报告已获批准并发布。")]];
    })();
  }

  getState() {
    return Promise.resolve(
      this.streamCount === 1
        ? {
            tasks: [
              {
                interrupts: [
                  {
                    id: "approve-publish-orders",
                    value: {
                      type: "approval",
                      reason: "business_write",
                      message: "确认发布订单质量报告吗？",
                      toolCallId: "publish-report-1",
                      responseSchema: {
                        type: "object",
                        properties: { approved: { const: true } },
                        required: ["approved"],
                      },
                    },
                  },
                ],
              },
            ],
          }
        : { tasks: [] },
    );
  }
}

function fixture() {
  const store = new InMemoryAgentStore();
  const agent = new InterruptingAgent();
  const runner = new AgentRunner(agent, store);
  const service = new AgentService(store, {}, runner);
  const session = store.createSession(principalA, "standalone", "HITL test");
  const snapshotId = "11111111-1111-4111-8111-111111111111";
  store.saveSnapshot({
    id: snapshotId,
    version: 1,
    ownerId: principalA.id,
    tenantId: principalA.tenantId,
    mode: "standalone",
    capturedAt: "2026-10-21T00:00:00.000Z",
    context: {
      user: { id: principalA.id, displayName: principalA.displayName },
      permissions: { scopes: [...principalA.permissionScopes] },
      object: { type: "table", id: "orders", name: "Orders" },
    },
  });
  const identity = {
    authenticate(authorization) {
      if (authorization === "Bearer token-a") return Promise.resolve(principalA);
      if (authorization === "Bearer token-b") return Promise.resolve(principalB);
      return Promise.reject(new ServiceError("UNAUTHENTICATED", "Authentication required.", 401));
    },
  };
  return {
    agent,
    handler: createApiHandler({ identity, service }),
    runner,
    service,
    session,
    snapshotId,
    store,
  };
}

function request(handler, token, path, body) {
  return handler(
    new Request(`http://localhost/api/v1${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    }),
  );
}

function agUiInput(sessionId, snapshotId, overrides = {}) {
  return {
    threadId: sessionId,
    runId: "client-run-1",
    protocolVersion: "1.0",
    messages: [{ id: "message-1", role: "user", content: "发布订单质量报告" }],
    tools: [],
    context: [],
    forwardedProps: {
      "enterprise-assistant": { contextSnapshotId: snapshotId },
    },
    ...overrides,
  };
}

function parseFrames(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((frame) => {
      const data = frame
        .split(/\r?\n/)
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      assert.ok(data);
      return JSON.parse(data);
    });
}

test("AG-UI interrupt outcome can be resumed with RunAgentInput.resume", async () => {
  const { agent, handler, session, snapshotId } = fixture();
  const first = await request(
    handler,
    "token-a",
    "/ag-ui",
    agUiInput(session.id, snapshotId),
  );
  assert.equal(first.status, 200);
  const interrupted = parseFrames(await first.text());
  const terminal = interrupted.at(-1);
  assert.equal(terminal.type, "RUN_FINISHED");
  assert.equal(terminal.outcome.type, "interrupt");
  assert.equal(terminal.outcome.interrupts[0].id, "approve-publish-orders");
  assert.equal(JSON.stringify(terminal).includes("authorizationRef"), false);

  const resumed = await request(
    handler,
    "token-a",
    "/ag-ui",
    agUiInput(session.id, snapshotId, {
      runId: "client-run-2",
      messages: [],
      forwardedProps: {},
      resume: [
        {
          interruptId: "approve-publish-orders",
          status: "resolved",
          payload: { approved: true },
        },
      ],
    }),
  );
  assert.equal(resumed.status, 200);
  const resumedEvents = parseFrames(await resumed.text());
  assert.equal(resumedEvents[0].type, "RUN_STARTED");
  assert.equal(resumedEvents.at(-1).outcome.type, "success");
  assert.deepEqual(agent.resumedValue, { approved: true });
});

test("enterprise resume endpoint enforces ownership, pending state, and idempotency", async () => {
  const { handler, runner, session, snapshotId, store } = fixture();
  const created = await request(handler, "token-a", `/sessions/${session.id}/runs`, {
    message: "发布订单质量报告",
    contextSnapshotId: snapshotId,
    clientRequestId: "initial-run",
  });
  assert.equal(created.status, 202);
  const original = await created.json();
  await runner.wait(original.runId);
  assert.equal(store.requireRun(original.runId, principalA).status, "interrupted");

  const history = await handler(
    new Request(`http://localhost/api/v1/sessions/${session.id}/messages`, {
      headers: { authorization: "Bearer token-a" },
    }),
  );
  assert.equal(history.status, 200);
  assert.equal((await history.json()).pendingInterrupts[0].id, "approve-publish-orders");

  const blockedNewRun = await request(handler, "token-a", `/sessions/${session.id}/runs`, {
    message: "绕过确认继续执行",
    contextSnapshotId: snapshotId,
    clientRequestId: "bypass-run",
  });
  assert.equal(blockedNewRun.status, 409);
  assert.equal((await blockedNewRun.json()).code, "INTERRUPT_RESUME_REQUIRED");

  const foreign = await request(handler, "token-b", `/runs/${original.runId}/resume`, {
    interruptId: "approve-publish-orders",
    status: "resolved",
    payload: { approved: true },
    clientRequestId: "foreign-resume",
  });
  assert.equal(foreign.status, 404);

  const approval = {
    interruptId: "approve-publish-orders",
    status: "resolved",
    payload: { approved: true },
    clientRequestId: "resume-once",
  };
  const resumed = await request(handler, "token-a", `/runs/${original.runId}/resume`, approval);
  assert.equal(resumed.status, 202);
  const continuation = await resumed.json();
  await runner.wait(continuation.runId);
  assert.equal(store.requireRun(continuation.runId, principalA).status, "completed");

  const replay = await request(handler, "token-a", `/runs/${original.runId}/resume`, approval);
  assert.equal(replay.status, 202);
  assert.equal((await replay.json()).runId, continuation.runId);

  const duplicate = await request(handler, "token-a", `/runs/${original.runId}/resume`, {
    ...approval,
    clientRequestId: "resume-twice",
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, "INTERRUPT_ALREADY_RESOLVED");
});
