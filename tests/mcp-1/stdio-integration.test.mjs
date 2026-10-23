import assert from "node:assert/strict";
import { isAbsolute, resolve } from "node:path";
import test from "node:test";

import {
  connectApprovedDevelopmentMcps,
  readDevelopmentMcpDeploymentConfig,
} from "../../apps/agent-server/dist/composition/mcp-bootstrap.js";

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
const configuredApprovals = process.env["MCP_TOOL_APPROVALS"];
if (configuredApprovals === undefined) {
  throw new Error("MCP_TOOL_APPROVALS must pin the approved Tool name, Schema digest and risk.");
}
const toolApprovals = JSON.parse(configuredApprovals);
if (!Array.isArray(toolApprovals) || toolApprovals.length === 0) {
  throw new Error("MCP_TOOL_APPROVALS must contain at least one Tool approval.");
}
const invokedToolName = process.env["MCP_TEST_TOOL_NAME"] ?? toolApprovals[0]?.toolName;
if (typeof invokedToolName !== "string") {
  throw new Error("MCP_TEST_TOOL_NAME must identify an approved Tool.");
}

test("agent-server composition discovers, approves, mounts and calls the external MCP", async () => {
  const config = readDevelopmentMcpDeploymentConfig(
    {
      MCP_DEVELOPMENT_STDIO: "true",
      MCP_SERVERS: JSON.stringify([
        {
          serverEntry,
          serverId,
          approvals: toolApprovals,
        },
      ]),
    },
    process.execPath,
  );
  assert.ok(config);
  const runtime = await connectApprovedDevelopmentMcps(config);
  try {
    assert.equal(runtime.tools.length, toolApprovals.length);
    assert.equal(runtime.serverStatuses[0]?.["status"], "ready");
    assert.equal(runtime.toolStatuses[0]?.["status"], "approved");
    assert.equal(typeof runtime.toolStatuses[0]?.["name"], "string");
    const modelToolName = `mcp_${serverId}_${invokedToolName}`.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const tool = runtime.tools.find((candidate) => candidate.name === modelToolName);
    assert.ok(tool, `Expected mounted Tool '${modelToolName}'.`);
    const result = await tool.invoke(toolArguments);
    assert.equal(typeof result, "object");
    assert.notEqual(result, null);
  } finally {
    await runtime.close();
  }
});
