import assert from "node:assert/strict";
import test from "node:test";

import {
  connectApprovedDevelopmentMcps,
  readDevelopmentMcpDeploymentConfig,
} from "../../apps/agent-server/dist/composition/mcp-bootstrap.js";

const configuredServers = process.env["MCP_TEST_SERVERS"];
if (configuredServers === undefined) {
  throw new Error("MCP_TEST_SERVERS must contain the MCP Servers and test arguments.");
}
const testServers = JSON.parse(configuredServers);
if (!Array.isArray(testServers) || testServers.length < 2) {
  throw new Error("MCP_TEST_SERVERS must contain at least two MCP Servers.");
}

test("one agent-server composition mounts and calls multiple approved MCP Servers", async () => {
  const config = readDevelopmentMcpDeploymentConfig(
    {
      MCP_DEVELOPMENT_STDIO: "true",
      MCP_SERVERS: JSON.stringify(
        testServers.map(({ serverId, serverEntry, approvals }) => ({
          serverId,
          serverEntry,
          approvals,
        })),
      ),
    },
    process.execPath,
  );
  assert.ok(config);
  const runtime = await connectApprovedDevelopmentMcps(config);
  try {
    assert.equal(runtime.serverStatuses.length, testServers.length);
    assert.equal(runtime.tools.length, testServers.length);
    for (const server of testServers) {
      const approval = server.approvals[0];
      const expectedName = `mcp_${server.serverId}_${approval.toolName}`.replaceAll(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
      const tool = runtime.tools.find((candidate) => candidate.name === expectedName);
      assert.ok(tool, `Expected mounted Tool '${expectedName}'.`);
      const result = await tool.invoke(server.toolArguments);
      assert.equal(typeof result, "object");
      assert.notEqual(result, null);
    }
  } finally {
    await runtime.close();
  }
});
