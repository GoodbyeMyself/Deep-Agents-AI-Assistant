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

test("agent-server composition discovers, approves, mounts and calls the external MCP", async () => {
  const config = readDevelopmentMcpDeploymentConfig(
    {
      MCP_DEVELOPMENT_STDIO: "true",
      MCP_SERVERS: JSON.stringify([
        {
          serverEntry,
          serverId,
          approvals: JSON.parse(configuredApprovals),
        },
      ]),
    },
    process.execPath,
  );
  assert.ok(config);
  const runtime = await connectApprovedDevelopmentMcps(config);
  try {
    assert.equal(runtime.tools.length, 1);
    assert.equal(runtime.serverStatuses[0]?.["status"], "ready");
    assert.equal(runtime.toolStatuses[0]?.["status"], "approved");
    const result = await runtime.tools[0]?.invoke(toolArguments);
    assert.equal(typeof result, "object");
    assert.notEqual(result, null);
  } finally {
    await runtime.close();
  }
});
