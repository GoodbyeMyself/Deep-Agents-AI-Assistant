import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectApprovedHttpMcps, readHttpMcpDeploymentConfig } from "../../apps/agent-server/dist/index.js";
import { createRestrictedMcpFetch, discoverMcpTools, validateHttpMcpEndpoint } from "../../packages/mcp-client-runtime/dist/index.js";

test("HTTP endpoint governance rejects plaintext defaults, credentials and unapproved hosts", () => {
  const base = { serverId: "test-http", endpoint: "https://example.com/mcp", allowedHosts: ["example.com"] };
  assert.equal(validateHttpMcpEndpoint(base).hostname, "example.com");
  for (const endpoint of ["http://example.com/mcp", "https://user:secret@example.com/mcp", "https://other.example/mcp", "https://example.com/mcp?token=secret"])
    assert.throws(() => validateHttpMcpEndpoint({ ...base, endpoint }));
  assert.throws(() => readHttpMcpDeploymentConfig({ MCP_HTTP_SERVERS: "[]" }), /LOCAL_DEMO/);
});

test("HTTP MCP uses signed per-principal requests, rechecks Schema and never follows redirects", async () => {
  const calls = [];
  let drift = false;
  const tool = { name: "read_item", description: "Read a test item", inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { status: { type: "string" } } },
    annotations: { readOnlyHint: true, destructiveHint: false },
    _meta: { "com.deep-agents.platform/governance": { protocolVersion: "1", riskLevel: "read" } } };
  const server = createServer(async (request, response) => {
    if (request.url === "/redirect") { response.writeHead(302, { location: "http://169.254.169.254/" }); response.end(); return; }
    if (request.method !== "POST") { response.writeHead(405); response.end(); return; }
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    if (message.id === undefined) { response.writeHead(202); response.end(); return; }
    const encoded = request.headers.authorization?.split(" ")[1]?.split(".")[1];
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    let result;
    if (message.method === "initialize") result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } };
    else if (message.method === "tools/list") result = { tools: [drift ? { ...tool, inputSchema: { type: "object", properties: { changed: { type: "string" } } } } : tool] };
    else if (message.method === "tools/call") {
      calls.push({ claims, arguments: message.params.arguments });
      result = { content: [], structuredContent: { status: "success" } };
    } else { response.writeHead(400); response.end(); return; }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const endpoint = { serverId: "test-http", endpoint: `http://127.0.0.1:${port}/mcp`, allowedHosts: [`127.0.0.1:${port}`], localDemoHttp: true };
  try {
    const [candidate] = await discoverMcpTools({ listTools: async () => ({ tools: [tool] }) }, { serverId: endpoint.serverId });
    const config = readHttpMcpDeploymentConfig({ ASSISTANT_LOCAL_DEMO: "true", MCP_DELEGATION_SECRET: "x".repeat(64),
      MCP_HTTP_SERVERS: JSON.stringify([{ ...endpoint, approvals: [{ toolName: tool.name, schemaDigest: candidate.schemaDigest, riskLevel: "read" }] }]) });
    const runtime = await connectApprovedHttpMcps(config);
    try {
      const context = { principalId: "user-one", tenantId: "tenant-one", runId: randomUUID(), sessionId: randomUUID() };
      assert.equal((await runtime.tools[0].invoke({}, { context })).status, "success");
      assert.equal((await runtime.tools[0].invoke({}, { context: { ...context, principalId: "user-two" } })).status, "success");
      assert.deepEqual(calls.map((call) => call.claims.sub), ["user-one", "user-two"]);
      assert.ok(calls.every((call) => call.claims.aud === "test-http" && call.claims.purpose === "tool" && call.claims.exp - call.claims.iat === 60));
      assert.deepEqual(calls[0].arguments, {});
      await assert.rejects(() => runtime.tools[0].invoke({}));
      drift = true;
      await assert.rejects(() => runtime.tools[0].invoke({}, { context }));
      assert.equal(calls.length, 2);
    } finally { await runtime.close(); }
    const fetch = createRestrictedMcpFetch({ ...endpoint, endpoint: `http://127.0.0.1:${port}/redirect` });
    await assert.rejects(() => fetch(`http://127.0.0.1:${port}/redirect`), /redirects/);
    await assert.rejects(() => fetch("http://169.254.169.254/"), /approved endpoint/);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
