import assert from "node:assert/strict";
import test from "node:test";

import { readDevelopmentMcpDeploymentConfig } from "../../apps/agent-server/dist/composition/mcp-bootstrap.js";

const digest = "a".repeat(64);
const productA = {
  serverId: "product-a-mcp",
  serverEntry: "E:\\mcp\\product-a\\stdio.js",
  approvals: [{ toolName: "get_quality_trend", schemaDigest: digest, riskLevel: "read" }],
};
const productB = {
  serverId: "product-b-mcp",
  serverEntry: "E:\\mcp\\product-b\\stdio.js",
  approvals: [{ toolName: "list_open_work_orders", schemaDigest: digest, riskLevel: "read" }],
};

test("agent-server accepts multiple explicitly approved MCP Servers", () => {
  const config = readDevelopmentMcpDeploymentConfig(
    {
      MCP_DEVELOPMENT_STDIO: "true",
      MCP_SERVERS: JSON.stringify([productA, productB]),
    },
    "C:\\Program Files\\nodejs\\node.exe",
  );

  assert.deepEqual(
    config?.servers.map((server) => server.serverId),
    ["product-a-mcp", "product-b-mcp"],
  );
  assert.equal(config?.servers[0]?.approvals[0]?.schemaDigest, digest);
});

test("agent-server rejects partial MCP configuration", () => {
  assert.throws(
    () =>
      readDevelopmentMcpDeploymentConfig(
        { MCP_DEVELOPMENT_STDIO: "true" },
        "C:\\Program Files\\nodejs\\node.exe",
      ),
    /MCP_SERVERS is required/,
  );
});

test("agent-server rejects duplicate MCP Server ids", () => {
  assert.throws(
    () =>
      readDevelopmentMcpDeploymentConfig(
        {
          MCP_DEVELOPMENT_STDIO: "true",
          MCP_SERVERS: JSON.stringify([productA, productA]),
        },
        "C:\\Program Files\\nodejs\\node.exe",
      ),
    /Duplicate MCP Server/,
  );
});

test("agent-server rejects stdio MCP in production", () => {
  assert.throws(
    () =>
      readDevelopmentMcpDeploymentConfig(
        {
          NODE_ENV: "production",
          MCP_DEVELOPMENT_STDIO: "true",
          MCP_SERVERS: JSON.stringify([productA]),
        },
        "C:\\Program Files\\nodejs\\node.exe",
      ),
    /forbidden when NODE_ENV=production/,
  );
});

test("agent-server rejects unpinned or malformed approval fields", () => {
  assert.throws(
    () =>
      readDevelopmentMcpDeploymentConfig(
        {
          MCP_DEVELOPMENT_STDIO: "true",
          MCP_SERVERS: JSON.stringify([
            {
              ...productA,
              approvals: [{ ...productA.approvals[0], autoApprove: true }],
            },
          ]),
        },
        "C:\\Program Files\\nodejs\\node.exe",
      ),
    /contains an unknown field/,
  );
});
