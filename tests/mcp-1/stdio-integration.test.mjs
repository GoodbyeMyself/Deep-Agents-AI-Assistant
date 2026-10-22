import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import test from "node:test";

import {
  connectDevelopmentStdioMcp,
  createApprovedMcpToolSnapshot,
  createMcpLangChainTools,
  discoverMcpTools,
} from "../../packages/mcp-client-runtime/dist/index.js";

const configuredEntry = process.env["MCP_SERVER_ENTRY"];
if (configuredEntry === undefined) {
  throw new Error("MCP_SERVER_ENTRY must point to the built MCP stdio entry.");
}
const serverEntry = isAbsolute(configuredEntry) ? configuredEntry : resolve(configuredEntry);
const configuredArguments = process.env["MCP_TEST_TOOL_ARGUMENTS"];
if (configuredArguments === undefined) {
  throw new Error("MCP_TEST_TOOL_ARGUMENTS must contain a JSON object for the discovered Tool.");
}
const toolArguments = JSON.parse(configuredArguments);
if (typeof toolArguments !== "object" || toolArguments === null || Array.isArray(toolArguments)) {
  throw new Error("MCP_TEST_TOOL_ARGUMENTS must contain a JSON object.");
}
const serverId = process.env["MCP_SERVER_ID"] ?? "integration-mcp";

test("main platform discovers, approves and calls the external business MCP over stdio", async () => {
  const connection = await connectDevelopmentStdioMcp({
    developmentOnly: true,
    serverId,
    command: process.execPath,
    args: [serverEntry],
  });
  try {
    const candidates = await discoverMcpTools(connection.client, {
      serverId: connection.serverId,
    });
    assert.equal(candidates.length, 1);
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
    const tools = createMcpLangChainTools({
      client: connection.client,
      approvedTools: snapshot.approved,
    });
    const result = await tools[0]?.invoke(toolArguments);
    assert.equal(typeof result, "object");
    assert.notEqual(result, null);
  } finally {
    await connection.close();
  }
});
