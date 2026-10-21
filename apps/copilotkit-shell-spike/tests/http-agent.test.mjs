/* global Request */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import { HttpAgent as AgUiHttpAgent } from "@ag-ui/client";
import {
  AgentService,
  createApiHandler,
  InMemoryAgentStore,
} from "../../agent-server/dist/index.js";

const principal = {
  id: "user-a",
  displayName: "User A",
  tenantId: "tenant-a",
  permissionScopes: ["data_quality:read"],
  authorizedObjectIds: ["orders"],
  authorizationRef: "mock-auth:user-a",
};

function createFixture() {
  const store = new InMemoryAgentStore();
  const session = store.createSession(principal, "standalone", "CopilotKit Spike");
  const snapshotId = "33333333-3333-4333-8333-333333333333";
  store.saveSnapshot({
    id: snapshotId,
    version: 1,
    ownerId: principal.id,
    tenantId: principal.tenantId,
    mode: "standalone",
    capturedAt: "2026-10-21T00:00:00.000Z",
    context: {
      user: { id: principal.id, displayName: principal.displayName },
      permissions: { scopes: [...principal.permissionScopes] },
      object: { type: "dataset", id: "orders", name: "Orders" },
    },
  });

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
      assert.equal(authorization, "Bearer token-a");
      return Promise.resolve(principal);
    },
  };

  return {
    handler: createApiHandler({ identity, service }),
    session,
    snapshotId,
    store,
  };
}

async function verifyHttpAgent(HttpAgentClass) {
  const { handler, session, snapshotId, store } = createFixture();
  const agent = new HttpAgentClass({
    agentId: "enterprise-assistant",
    threadId: session.id,
    url: "http://localhost/api/v1/ag-ui",
    headers: { authorization: "Bearer token-a" },
    fetch: (url, init) => handler(new Request(url, init)),
  });
  agent.setMessages([{ id: "message-1", role: "user", content: "Show quality trend" }]);

  const result = await agent.runAgent({
    forwardedProps: {
      "enterprise-assistant": { contextSnapshotId: snapshotId },
    },
  });

  assert.equal(agent.isRunning, false);
  assert.equal(
    result.newMessages.some((message) => message.role === "assistant"),
    true,
  );
  assert.equal(
    agent.messages.some(
      (message) => message.role === "assistant" && message.content === "Authorized answer.",
    ),
    true,
  );
  const storedMessage = store.listMessages(session.id, principal)[0];
  assert.equal(storedMessage?.content, "Show quality trend");
  assert.equal(store.requireRun(storedMessage.runId, principal).contextSnapshotId, snapshotId);
}

test("official @ag-ui/client 1.0.3 consumes the governed AG-UI endpoint", async () => {
  await verifyHttpAgent(AgUiHttpAgent);
});

test("CopilotKit 1.79.1 keeps its bundled client on the AG-UI 1.0 line", async () => {
  const packageJson = JSON.parse(
    await readFile(
      new URL("../node_modules/@copilotkit/react-core/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(packageJson.version, "1.79.1");
  assert.equal(packageJson.dependencies?.["@ag-ui/client"], "1.0.2");
});
