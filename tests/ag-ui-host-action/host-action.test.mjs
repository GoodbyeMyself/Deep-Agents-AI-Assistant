import assert from "node:assert/strict";
import test from "node:test";

import { AIMessage, ToolMessage } from "@langchain/core/messages";

import { AgentRunner, InMemoryAgentStore } from "../../apps/agent-server/dist/index.js";
import { bridgeMessageSchema } from "../../packages/iframe-bridge/dist/index.js";

const principal = {
  id: "user-a",
  displayName: "User A",
  tenantId: "tenant-a",
  permissionScopes: [],
  authorizedObjectIds: ["orders"],
  authorizationRef: "mock-auth:user-a",
};

class NavigationAgent {
  constructor(
    toolName = "platform_host-navigation_present_navigation",
    target = "demo.issue-list",
  ) {
    this.toolName = toolName;
    this.target = target;
  }

  stream() {
    const toolName = this.toolName;
    const target = this.target;
    return Promise.resolve(
      (async function* navigationStream() {
        yield [
          [],
          [
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  id: "navigation-call-1",
                  name: toolName,
                  args: { target, label: "查看问题列表" },
                  type: "tool_call",
                },
              ],
            }),
          ],
        ];
        yield [
          [],
          [
            new ToolMessage({
              tool_call_id: "navigation-call-1",
              name: toolName,
              content: JSON.stringify({
                status: "success",
                hostAction: {
                  type: "host.navigate",
                  target,
                  label: "查看问题列表",
                },
              }),
            }),
          ],
        ];
        yield [[], [new AIMessage("已为你准备好问题工单页面入口。")]];
      })(),
    );
  }
}

async function runNavigationAgent(agent, clientRequestId) {
  const store = new InMemoryAgentStore();
  const session = store.createSession(principal, "assistant", "Host action test");
  const snapshotId = "11111111-1111-4111-8111-111111111111";
  store.saveSnapshot({
    id: snapshotId,
    version: 1,
    ownerId: principal.id,
    tenantId: principal.tenantId,
    mode: "assistant",
    capturedAt: "2026-10-23T00:00:00.000Z",
    context: {
      user: { id: principal.id, displayName: principal.displayName },
      permissions: { scopes: [] },
      object: { type: "table", id: "orders", name: "Orders" },
      hostActions: [{ target: "demo.issue-list", label: "打开问题列表" }],
    },
  });
  const { run } = store.createRun({
    principal,
    sessionId: session.id,
    contextSnapshotId: snapshotId,
    clientRequestId,
    message: "带我去问题工单页面",
  });
  const runner = new AgentRunner(agent, store);
  runner.start(run, principal);
  await runner.wait(run.id);

  return {
    store,
    session,
    run,
    events: store.listEvents(run.id, principal),
  };
}

test("model tool output becomes a replayable AG-UI navigation view", async () => {
  const { store, session, run, events } = await runNavigationAgent(
    new NavigationAgent(),
    "host-action-test",
  );

  const view = events.find((event) => event.type === "view.created");
  assert.equal(store.requireRun(run.id, principal).status, "completed");
  assert.equal(view?.data.viewType, "action.navigate");
  assert.equal(view?.data.data.target, "demo.issue-list");
  assert.equal(view?.data.data.label, "打开问题列表");
  assert.equal(JSON.stringify(view).includes("https://"), false);

  const assistantMessage = store
    .listMessages(session.id, principal)
    .find((message) => message.role === "assistant");
  assert.equal(assistantMessage?.views?.length, 1);
  assert.equal(assistantMessage?.views?.[0]?.viewType, "action.navigate");
  assert.equal(assistantMessage?.views?.[0]?.data.target, "demo.issue-list");
});

test("other platform and MCP tools cannot create host action views", async () => {
  for (const [index, toolName] of [
    "platform_other_present_navigation",
    "mcp_demo_present_navigation",
  ].entries()) {
    const { events } = await runNavigationAgent(
      new NavigationAgent(toolName),
      `ignored-host-action-${index}`,
    );
    assert.equal(
      events.some((event) => event.type === "view.created"),
      false,
    );
  }
});

test("the navigation tool cannot create a view for an unadvertised target", async () => {
  const { events } = await runNavigationAgent(
    new NavigationAgent("platform_host-navigation_present_navigation", "demo.unadvertised"),
    "unadvertised-host-action",
  );
  assert.equal(
    events.some((event) => event.type === "view.created"),
    false,
  );
});

test("iframe bridge accepts opaque actions and rejects URL targets", () => {
  const base = {
    protocol: "enterprise-assistant-bridge",
    version: 1,
    channelId: "22222222-2222-4222-8222-222222222222",
    requestId: "33333333-3333-4333-8333-333333333333",
    type: "assistant.host-action",
  };
  assert.equal(
    bridgeMessageSchema.parse({
      ...base,
      payload: {
        type: "host.navigate",
        target: "demo.issue-list",
        label: "查看问题列表",
      },
    }).type,
    "assistant.host-action",
  );
  assert.equal(
    bridgeMessageSchema.safeParse({
      ...base,
      payload: {
        type: "host.navigate",
        target: "https://evil.example",
        label: "打开链接",
      },
    }).success,
    false,
  );
});
