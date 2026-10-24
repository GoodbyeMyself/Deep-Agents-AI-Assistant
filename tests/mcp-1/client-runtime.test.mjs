import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_GOVERNANCE_META_KEY,
  createApprovedMcpToolSnapshot,
  createMcpLangChainTools,
  discoverMcpTools,
} from "../../packages/mcp-client-runtime/dist/index.js";

function definition(overrides = {}) {
  return {
    name: "quality_trend",
    description: "Get a quality trend.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { tableId: { type: "string" } },
      required: ["tableId"],
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { status: { type: "string" } },
      required: ["status"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
    _meta: {
      [PLATFORM_GOVERNANCE_META_KEY]: { protocolVersion: "1", riskLevel: "read" },
    },
    ...overrides,
  };
}

function fakeClient(toolDefinitions = [definition()]) {
  const calls = [];
  return {
    calls,
    listTools: async () => ({ tools: toolDefinitions }),
    callTool: async (params, options) => {
      calls.push({ params, options });
      return { content: [], structuredContent: { status: "success" } };
    },
    close: async () => {},
  };
}

test("only validated public error metadata is released; raw MCP errors remain hidden", async () => {
  for (const safe of [true, false]) {
    const client = fakeClient();
    client.callTool = async () => ({
      isError: true,
      content: [{ type: "text", text: "private upstream response" }],
      _meta: {
        "com.deep-agents.platform/public-error": safe
          ? { code: "CONFLICT", message: "请先解除关联。" }
          : { code: "CONFLICT", message: "bad\nmessage" },
      },
    });
    const candidates = await discoverMcpTools(client, { serverId: "demo-a" });
    const [tool] = createMcpLangChainTools({ client, approvedTools: candidates });
    await assert.rejects(tool.invoke({ tableId: "orders" }), (error) => {
      assert.equal(error.code, safe ? "MCP_BUSINESS_REJECTED" : "MCP_TOOL_ERROR");
      assert.equal(error.message.includes("private upstream"), false);
      if (safe) assert.equal(error.message, "请先解除关联。");
      return true;
    });
  }
});

test("discovery creates a deterministic, read-only candidate without business imports", async () => {
  const client = fakeClient();
  const first = await discoverMcpTools(client, { serverId: "demo-a" });
  const second = await discoverMcpTools(client, { serverId: "demo-a" });
  assert.equal(first.length, 1);
  assert.equal(first[0]?.riskLevel, "read");
  assert.match(first[0]?.schemaDigest ?? "", /^[a-f0-9]{64}$/);
  assert.equal(first[0]?.schemaDigest, second[0]?.schemaDigest);
});

test("only exact server, tool, risk and Schema digest approvals enter the snapshot", async () => {
  const candidates = await discoverMcpTools(fakeClient(), { serverId: "demo-a" });
  const candidate = candidates[0];
  assert.ok(candidate);
  const snapshot = createApprovedMcpToolSnapshot(candidates, [
    {
      serverId: candidate.serverId,
      toolName: candidate.name,
      schemaDigest: candidate.schemaDigest,
      riskLevel: "read",
    },
  ]);
  assert.equal(snapshot.approved.length, 1);
  assert.equal(snapshot.unapproved.length, 0);
  assert.throws(
    () =>
      createApprovedMcpToolSnapshot(candidates, [
        {
          serverId: candidate.serverId,
          toolName: candidate.name,
          schemaDigest: "0".repeat(64),
          riskLevel: "read",
        },
      ]),
    /approval drift/,
  );
});

test("unapproved or inconsistent remote tools are never exposed", async () => {
  const candidates = await discoverMcpTools(fakeClient(), { serverId: "demo-a" });
  const snapshot = createApprovedMcpToolSnapshot(candidates, []);
  assert.equal(snapshot.approved.length, 0);
  assert.equal(snapshot.unapproved.length, 1);
  await assert.rejects(
    () =>
      discoverMcpTools(
        fakeClient([
          definition({
            annotations: { readOnlyHint: false, destructiveHint: true },
            _meta: {
              [PLATFORM_GOVERNANCE_META_KEY]: { protocolVersion: "1", riskLevel: "high" },
            },
          }),
        ]),
        { serverId: "demo-a" },
      ),
    /inconsistent governance risk annotations/,
  );
});

test("approved MCP Tools become LangChain Tools and return only structured content", async () => {
  const client = fakeClient();
  const candidates = await discoverMcpTools(client, { serverId: "demo-a" });
  const candidate = candidates[0];
  assert.ok(candidate);
  const snapshot = createApprovedMcpToolSnapshot(candidates, [
    {
      serverId: candidate.serverId,
      toolName: candidate.name,
      schemaDigest: candidate.schemaDigest,
      riskLevel: "read",
    },
  ]);
  const tools = createMcpLangChainTools({ client, approvedTools: snapshot.approved });
  assert.equal(tools[0]?.name, "mcp_demo-a_quality_trend");
  assert.deepEqual(await tools[0]?.invoke({ tableId: "orders" }), { status: "success" });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0]?.params.name, "quality_trend");
  assert.deepEqual(client.calls[0]?.params.arguments, { tableId: "orders" });
  assert.equal(client.calls[0]?.options.toolDefinition.name, "quality_trend");
});

test("LangChain cancellation is forwarded to the MCP request", async () => {
  const client = fakeClient();
  const candidates = await discoverMcpTools(client, { serverId: "demo-a" });
  const candidate = candidates[0];
  assert.ok(candidate);
  const tools = createMcpLangChainTools({ client, approvedTools: [candidate] });
  const controller = new AbortController();
  await tools[0]?.invoke({ tableId: "orders" }, { signal: controller.signal });
  assert.equal(client.calls[0]?.options.signal, controller.signal);
});

test("Tool execution errors are sanitized before entering the model context", async () => {
  const client = fakeClient();
  client.callTool = async () => ({
    isError: true,
    content: [{ type: "text", text: "secret-token=do-not-leak" }],
  });
  const candidates = await discoverMcpTools(client, { serverId: "demo-a" });
  const candidate = candidates[0];
  assert.ok(candidate);
  const tools = createMcpLangChainTools({ client, approvedTools: [candidate] });
  await assert.rejects(
    () => tools[0]?.invoke({ tableId: "orders" }),
    (error) => error?.code === "MCP_TOOL_ERROR" && !String(error.message).includes("secret-token"),
  );
});
