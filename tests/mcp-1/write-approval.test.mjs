import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { AIMessage } from "@langchain/core/messages";
import { createMcpLangChainTools } from "../../packages/mcp-client-runtime/dist/index.js";
import { requireMcpToolConfirmation } from "../../apps/agent-server/dist/modules/mcp/tool-confirmation.js";
import { AgentRunner, InMemoryAgentStore } from "../../apps/agent-server/dist/index.js";
import {
  initialAgUiProjectionState,
  projectAssistantEventToAgUi,
} from "../../packages/contracts/dist/index.js";
const require = createRequire(new URL("../../apps/agent-server/package.json", import.meta.url));
const {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
  Command,
  START,
  END,
} = require("@langchain/langgraph");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const definition = {
  name: "write_record",
  description: "Write a record",
  inputSchema: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: { success: { type: "boolean" } },
    required: ["success"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
  _meta: { "com.deep-agents.platform/governance": { protocolVersion: "1", riskLevel: "write" } },
};
function fixture(
  risk = "write",
  approvalHandler = requireMcpToolConfirmation,
  handleToolErrors = true,
) {
  const toolDefinition = {
    ...definition,
    annotations: { readOnlyHint: risk === "read", destructiveHint: risk === "destructive" },
    _meta: { "com.deep-agents.platform/governance": { protocolVersion: "1", riskLevel: risk } },
  };
  const calls = [];
  const client = {
    listTools: async () => ({ tools: [toolDefinition] }),
    callTool: async (request) => {
      calls.push(request);
      return { content: [], structuredContent: { success: true } };
    },
    close: async () => {},
  };
  const tools = createMcpLangChainTools({
    client,
    approvedTools: [
      {
        serverId: "demo-a",
        name: definition.name,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        schemaDigest: "a".repeat(64),
        riskLevel: risk,
        definition: toolDefinition,
      },
    ],
    approveWrite: approvalHandler,
  });
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("tools", new ToolNode(tools, { handleToolErrors }))
    .addEdge(START, "tools")
    .addEdge("tools", END)
    .compile({ checkpointer: new MemorySaver() });
  const config = {
    configurable: { thread_id: crypto.randomUUID() },
    context: { sessionId: crypto.randomUUID(), principalId: "test-user", tenantId: "test-tenant" },
  };
  const input = {
    messages: [
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: tools[0].name,
            args: { name: "approval-test" },
            id: "call-test",
            type: "tool_call",
          },
        ],
      }),
    ],
  };
  return { graph, config, input, calls };
}
test("real LangGraph write interrupts before invocation and resumes the exact call only after approval", async () => {
  const f = fixture();
  await f.graph.invoke(f.input, f.config);
  assert.equal(f.calls.length, 0);
  const state = await f.graph.getState(f.config);
  assert.equal(state.tasks[0].interrupts.length, 1);
  assert.match(state.tasks[0].interrupts[0].value.message, /approval-test/);
  await f.graph.invoke(new Command({ resume: { approved: true } }), f.config);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0]._meta["com.deep-agents.platform/write-key"], /^[a-f0-9]{64}$/);
});

for (const status of ["cancelled", "resolved"]) {
  test(`real graph rejection (${status}) finishes runner as cancelled, never as RUN_ERROR`, async () => {
    const f = fixture("destructive", requireMcpToolConfirmation, false);
    const principal = {
      id: "test-user",
      tenantId: "test-tenant",
      displayName: "Test",
      permissionScopes: [],
      authorizedObjectIds: [],
      authorizationRef: "mock-auth:test-user",
    };
    const store = new InMemoryAgentStore();
    const session = store.createSession(principal, "standalone", "Reject write");
    const snapshotId = crypto.randomUUID();
    store.saveSnapshot({
      id: snapshotId,
      version: 1,
      ownerId: principal.id,
      tenantId: principal.tenantId,
      mode: "standalone",
      capturedAt: new Date().toISOString(),
      context: {
        user: { id: principal.id, displayName: principal.displayName },
        permissions: { scopes: [] },
      },
    });
    const config = { ...f.config, configurable: { thread_id: session.threadId } };
    await f.graph.invoke(f.input, config);
    const { run } = store.createRun({
      principal,
      sessionId: session.id,
      contextSnapshotId: snapshotId,
      clientRequestId: crypto.randomUUID(),
      message: "Reject write",
    });
    const runner = new AgentRunner(f.graph, store);
    runner.resume(run, principal, {
      interruptId: "test-interrupt",
      status,
      payload: { approved: false },
      clientRequestId: "reject",
    });
    await runner.wait(run.id);
    assert.equal(store.requireRun(run.id, principal).status, "cancelled");
    assert.equal(store.requireRun(run.id, principal).errorCode, undefined);
    assert.equal(f.calls.length, 0);
    const events = store.listEvents(run.id, principal);
    assert.equal(
      events.some((event) => event.type === "run.failed"),
      false,
    );
    assert.equal(events.at(-1).type, "run.cancelled");
    assert.match(store.listMessages(session.id, principal).at(-1).content, /操作已取消/);
    let projection = initialAgUiProjectionState;
    const frames = [];
    for (const event of events) {
      const result = projectAssistantEventToAgUi(event, projection);
      projection = result.state;
      frames.push(...result.events);
    }
    assert.equal(frames.at(-1).type, "RUN_FINISHED");
    assert.equal(frames.at(-1).outcome.type, "cancelled");
    assert.equal(
      frames.some((frame) => frame.type === "RUN_ERROR"),
      false,
    );
    await runner.close();
  });
}

test("an unrelated error with a cancellation-like name remains a failure", async () => {
  const store = new InMemoryAgentStore();
  const principal = {
    id: "test-user",
    tenantId: "test-tenant",
    displayName: "Test",
    permissionScopes: [],
    authorizedObjectIds: [],
    authorizationRef: "mock-auth:test",
  };
  const session = store.createSession(principal, "standalone", "Failure");
  const snapshotId = crypto.randomUUID();
  store.saveSnapshot({
    id: snapshotId,
    version: 1,
    ownerId: principal.id,
    tenantId: principal.tenantId,
    mode: "standalone",
    capturedAt: new Date().toISOString(),
    context: {
      user: { id: principal.id, displayName: principal.displayName },
      permissions: { scopes: [] },
    },
  });
  const { run } = store.createRun({
    principal,
    sessionId: session.id,
    contextSnapshotId: snapshotId,
    clientRequestId: "fail",
    message: "Failure",
  });
  const runner = new AgentRunner(
    {
      stream: async () => {
        const error = new Error("Provider failed");
        error.name = "McpToolConfirmationCancelled";
        throw error;
      },
    },
    store,
  );
  runner.start(run, principal);
  await runner.wait(run.id);
  assert.equal(store.requireRun(run.id, principal).status, "failed");
  assert.equal(store.listEvents(run.id, principal).at(-1).type, "run.failed");
  await runner.close();
});
test("cancelled LangGraph approval never invokes MCP", async () => {
  const f = fixture();
  await f.graph.invoke(f.input, f.config);
  await f.graph.invoke(new Command({ resume: { __agui_cancelled__: true } }), f.config);
  assert.equal(f.calls.length, 0);
});

test("platform risk policy is immutable and unknown risk is denied", async () => {
  const { MCP_TOOL_EXECUTION_POLICY, resolveMcpToolExecutionDecision } =
    await import("../../packages/mcp-client-runtime/dist/index.js");
  assert.equal(Object.isFrozen(MCP_TOOL_EXECUTION_POLICY), true);
  assert.equal(resolveMcpToolExecutionDecision("read"), "execute");
  assert.equal(resolveMcpToolExecutionDecision("write"), "confirm");
  assert.equal(resolveMcpToolExecutionDecision("destructive"), "confirm");
  for (const value of [undefined, null, "unknown", "constructor", { riskLevel: "read" }])
    assert.throws(() => resolveMcpToolExecutionDecision(value));
});

test("authorized read executes immediately without calling confirmation or adding write metadata", async () => {
  let confirmations = 0;
  const f = fixture("read", () => {
    confirmations++;
    throw Error("read must not ask for confirmation");
  });
  await f.graph.invoke(f.input, f.config);
  assert.equal(f.calls.length, 1);
  assert.equal(confirmations, 0);
  assert.equal(f.calls[0]._meta, undefined);
  assert.equal((await f.graph.getState(f.config)).tasks.length, 0);
});

test("destructive operation waits for user confirmation and rejection makes no MCP call", async () => {
  const f = fixture("destructive");
  await f.graph.invoke(f.input, f.config);
  const state = await f.graph.getState(f.config);
  assert.equal(f.calls.length, 0);
  assert.match(state.tasks[0].interrupts[0].value.message, /删除不可恢复/);
  await f.graph.invoke(new Command({ resume: { approved: false } }), f.config);
  assert.equal(f.calls.length, 0);
});

test("approved destructive operation resumes only its exact arguments", async () => {
  const f = fixture("destructive");
  await f.graph.invoke(f.input, f.config);
  assert.equal(f.calls.length, 0);
  await f.graph.invoke(new Command({ resume: { approved: true } }), f.config);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].arguments, { name: "approval-test" });
});

test("write tools cannot be exposed without a platform confirmation handler", () => {
  // null bypasses the fixture default, representing an unconfigured transport integration.
  assert.throws(() => fixture("write", null), /confirmation handler is required/);
  assert.throws(() => fixture("destructive", null), /confirmation handler is required/);
});

test("a plain boolean or forged confirmation receipt cannot execute a write", async () => {
  for (const answer of [true, "", "approved", undefined]) {
    const f = fixture("write", () => answer);
    await f.graph.invoke(f.input, f.config);
    assert.equal(f.calls.length, 0);
  }
});
