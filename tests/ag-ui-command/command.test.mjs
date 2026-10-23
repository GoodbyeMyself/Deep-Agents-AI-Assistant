import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentService,
  createApiHandler,
  createNodeHttpServer,
  InMemoryAgentStore,
  ServiceError,
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

function saveSnapshot(store, principal, id) {
  store.saveSnapshot({
    id,
    version: 1,
    ownerId: principal.id,
    tenantId: principal.tenantId,
    mode: "standalone",
    capturedAt: "2026-10-21T00:00:00.000Z",
    context: {
      user: { id: principal.id, displayName: principal.displayName },
      permissions: { scopes: [...principal.permissionScopes] },
      object: { type: "table", id: "orders", name: "Orders" },
    },
  });
}

function createFixture() {
  const store = new InMemoryAgentStore();
  const session = store.createSession(principalA, "standalone", "AG-UI command test");
  const snapshotA = "11111111-1111-4111-8111-111111111111";
  const snapshotB = "22222222-2222-4222-8222-222222222222";
  saveSnapshot(store, principalA, snapshotA);
  saveSnapshot(store, principalB, snapshotB);

  const runner = {
    start(run) {
      store.setRunStatus(run.id, "running");
      store.appendEvent(run.id, "run.started", { modelConfigVersion: "mock@1" });
      store.appendEvent(run.id, "message.delta", { delta: "Authorized answer." });
      store.appendEvent(run.id, "run.completed", { evidenceRefs: [] });
      store.setRunStatus(run.id, "completed");
    },
    cancel() {},
  };
  const service = new AgentService(store, {}, runner);
  const identity = {
    authenticate(authorization) {
      if (authorization === "Bearer token-a") return Promise.resolve(principalA);
      if (authorization === "Bearer token-b") return Promise.resolve(principalB);
      return Promise.reject(new ServiceError("UNAUTHENTICATED", "Authentication required.", 401));
    },
  };
  return {
    handler: createApiHandler({ identity, service }),
    session,
    snapshotA,
    snapshotB,
    store,
  };
}

function createCancellableFixture() {
  const store = new InMemoryAgentStore();
  const session = store.createSession(principalA, "standalone", "AG-UI cancellation test");
  const snapshotA = "11111111-1111-4111-8111-111111111111";
  saveSnapshot(store, principalA, snapshotA);
  let cancelled;

  const runner = {
    start(run) {
      store.setRunStatus(run.id, "running");
      store.appendEvent(run.id, "run.started", { modelConfigVersion: "mock@1" });
    },
    cancel(runId, principal) {
      const run = store.requireRun(runId, principal);
      if (run.status !== "queued" && run.status !== "running") return;
      store.setRunStatus(runId, "cancelled");
      store.appendEvent(runId, "run.cancelled", { reason: "user_requested" });
      cancelled = { runId, principalId: principal.id };
    },
  };
  const service = new AgentService(store, {}, runner);
  const identity = {
    authenticate(authorization) {
      if (authorization === "Bearer token-a") return Promise.resolve(principalA);
      return Promise.reject(new ServiceError("UNAUTHENTICATED", "Authentication required.", 401));
    },
  };

  return {
    handler: createApiHandler({ identity, service }),
    session,
    snapshotA,
    store,
    getCancelled: () => cancelled,
  };
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for cancellation.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function input(sessionId, snapshotId, overrides = {}) {
  return {
    threadId: sessionId,
    runId: "client-run-1",
    protocolVersion: "1.0",
    messages: [{ id: "message-1", role: "user", content: "Show quality trend" }],
    tools: [],
    context: [],
    forwardedProps: {
      "enterprise-assistant": { contextSnapshotId: snapshotId },
    },
    ...overrides,
  };
}

function command(handler, token, payload) {
  return handler(
    new Request("http://localhost/api/v1/ag-ui", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    }),
  );
}

function parseFrames(text) {
  return text
    .split(/\r?\n\r?\n/)
    .filter((frame) => frame.length > 0)
    .map((frame) => {
      const data = frame
        .split(/\r?\n/)
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      assert.ok(data);
      return JSON.parse(data);
    });
}

test("runs through the governed Session and ContextSnapshot boundary", async () => {
  const { handler, session, snapshotA, store } = createFixture();
  const payload = input(session.id, snapshotA, {
    context: [{ description: "untrusted", value: "platform:admin" }],
    state: { authorizationRef: "forged-admin" },
  });

  const response = await command(handler, "token-a", payload);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const events = parseFrames(await response.text());
  assert.equal(events[0]?.type, "RUN_STARTED");
  assert.equal(events[0]?.threadId, session.id);
  assert.equal(events[0]?.runId, payload.runId);
  assert.equal(events.at(-1)?.type, "RUN_FINISHED");
  assert.equal(events.at(-1)?.runId, payload.runId);

  const storedMessage = store.listMessages(session.id, principalA)[0];
  assert.equal(storedMessage?.content, "Show quality trend");
  assert.ok(storedMessage?.runId);
  assert.equal(store.requireRun(storedMessage.runId, principalA).contextSnapshotId, snapshotA);
  assert.equal(JSON.stringify(events).includes("forged-admin"), false);
});

test("rejects client tools, non-text content, and malformed interrupt resume", async () => {
  const { handler, session, snapshotA } = createFixture();
  const withTools = await command(
    handler,
    "token-a",
    input(session.id, snapshotA, {
      tools: [{ name: "become_admin", description: "unsafe" }],
    }),
  );
  assert.equal(withTools.status, 422);
  assert.equal((await withTools.json()).code, "UNSUPPORTED_CLIENT_TOOLS");

  const withFile = await command(
    handler,
    "token-a",
    input(session.id, snapshotA, {
      messages: [
        {
          id: "message-file",
          role: "user",
          content: [{ type: "document", source: { type: "url", value: "https://example.test/a" } }],
        },
      ],
    }),
  );
  assert.equal(withFile.status, 422);
  assert.equal((await withFile.json()).code, "UNSUPPORTED_AG_UI_CONTENT");

  const withResume = await command(
    handler,
    "token-a",
    input(session.id, snapshotA, {
      messages: [],
      resume: [{ interruptId: "interrupt-1", status: "resolved" }],
    }),
  );
  assert.equal(withResume.status, 400);
  assert.equal((await withResume.json()).code, "INVALID_AG_UI_INPUT");

  const incompatibleVersion = await command(
    handler,
    "token-a",
    input(session.id, snapshotA, { protocolVersion: "2.0" }),
  );
  assert.equal(incompatibleVersion.status, 422);
  assert.equal((await incompatibleVersion.json()).code, "UNSUPPORTED_AG_UI_VERSION");
});

test("fails closed for missing, foreign, or cross-user enterprise resources", async () => {
  const { handler, session, snapshotA, snapshotB } = createFixture();

  const missingSnapshot = await command(
    handler,
    "token-a",
    input(session.id, snapshotA, { forwardedProps: {} }),
  );
  assert.equal(missingSnapshot.status, 400);
  assert.equal((await missingSnapshot.json()).code, "INVALID_AG_UI_INPUT");

  const foreignSnapshot = await command(handler, "token-a", input(session.id, snapshotB));
  assert.equal(foreignSnapshot.status, 404);
  assert.equal((await foreignSnapshot.json()).code, "NOT_FOUND");

  const crossUserSession = await command(handler, "token-b", input(session.id, snapshotB));
  assert.equal(crossUserSession.status, 404);
  assert.equal((await crossUserSession.json()).code, "NOT_FOUND");
});

test("requires authentication before parsing AG-UI command input", async () => {
  const { handler, session, snapshotA } = createFixture();
  const response = await handler(
    new Request("http://localhost/api/v1/ag-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input(session.id, snapshotA)),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});

test("maps an aborted AG-UI HTTP stream to the authenticated durable run", async () => {
  const { handler, session, snapshotA, store, getCancelled } = createCancellableFixture();
  const server = createNodeHttpServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/ag-ui`, {
      method: "POST",
      headers: {
        authorization: "Bearer token-a",
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(input(session.id, snapshotA, { runId: "client-cancel-run" })),
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.equal(first.done, false);
    assert.match(new TextDecoder().decode(first.value), /RUN_STARTED/);

    controller.abort();
    await waitFor(() => getCancelled() !== undefined);

    const cancellation = getCancelled();
    assert.equal(cancellation.principalId, principalA.id);
    assert.notEqual(cancellation.runId, "client-cancel-run");
    assert.equal(store.requireRun(cancellation.runId, principalA).status, "cancelled");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
