import { isAbsolute } from "node:path";

import {
  connectDevelopmentStdioMcp,
  createApprovedMcpToolSnapshot,
  createMcpLangChainTools,
  discoverMcpTools,
  type McpClientConnection,
  type McpToolApproval,
} from "@assistant/mcp-client-runtime";
import type { StructuredToolInterface } from "@langchain/core/tools";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export interface DevelopmentMcpServerConfig {
  readonly serverId: string;
  readonly serverEntry: string;
  readonly approvals: readonly McpToolApproval[];
}

export interface DevelopmentMcpDeploymentConfig {
  readonly nodeExecutable: string;
  readonly servers: readonly DevelopmentMcpServerConfig[];
}

export interface ConfiguredMcpRuntime {
  readonly tools: readonly StructuredToolInterface[];
  readonly serverStatuses: readonly Readonly<Record<string, unknown>>[];
  readonly toolStatuses: readonly Readonly<Record<string, unknown>>[];
  close(): Promise<void>;
}

interface ConnectedMcpServer {
  readonly tools: readonly StructuredToolInterface[];
  readonly serverStatus: Readonly<Record<string, unknown>>;
  readonly toolStatuses: readonly Readonly<Record<string, unknown>>[];
  close(): Promise<void>;
}

function optionalEnv(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function requireEnv(environment: NodeJS.ProcessEnv, name: string): string {
  const value = optionalEnv(environment, name);
  if (value === undefined) throw new Error(`${name} is required when MCP is configured.`);
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new Error(`${label} contains an unknown field.`);
  }
}

function parseApprovals(
  value: unknown,
  serverId: string,
  label: string,
): readonly McpToolApproval[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array.`);
  }

  const toolNames = new Set<string>();
  const approvals = value.map((item, index): McpToolApproval => {
    const approvalLabel = `${label}[${index}]`;
    const record = requireRecord(item, approvalLabel);
    rejectUnknownFields(record, ["toolName", "schemaDigest", "riskLevel"], approvalLabel);
    const toolName = record["toolName"];
    const schemaDigest = record["schemaDigest"];
    if (typeof toolName !== "string" || toolName.length === 0 || toolName.length > 128) {
      throw new Error(`${approvalLabel}.toolName is invalid.`);
    }
    if (toolNames.has(toolName)) throw new Error(`Duplicate MCP Tool approval '${toolName}'.`);
    toolNames.add(toolName);
    if (typeof schemaDigest !== "string" || !SHA256_PATTERN.test(schemaDigest)) {
      throw new Error(`${approvalLabel}.schemaDigest must be a SHA-256 digest.`);
    }
    if (record["riskLevel"] !== "read") {
      throw new Error(`${approvalLabel}.riskLevel must be 'read'.`);
    }
    return Object.freeze({ serverId, toolName, schemaDigest, riskLevel: "read" });
  });
  return Object.freeze(approvals);
}

function parseServers(raw: string): readonly DevelopmentMcpServerConfig[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("MCP_SERVERS must be valid JSON.");
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("MCP_SERVERS must be a non-empty JSON array.");
  }

  const serverIds = new Set<string>();
  const servers = value.map((item, index): DevelopmentMcpServerConfig => {
    const label = `MCP_SERVERS[${index}]`;
    const record = requireRecord(item, label);
    rejectUnknownFields(record, ["serverId", "serverEntry", "approvals"], label);
    const serverId = record["serverId"];
    const serverEntry = record["serverEntry"];
    if (typeof serverId !== "string" || !SERVER_ID_PATTERN.test(serverId)) {
      throw new Error(`${label}.serverId is invalid.`);
    }
    if (serverIds.has(serverId)) throw new Error(`Duplicate MCP Server '${serverId}'.`);
    serverIds.add(serverId);
    if (typeof serverEntry !== "string" || !isAbsolute(serverEntry)) {
      throw new Error(`${label}.serverEntry must be an absolute path.`);
    }
    return Object.freeze({
      serverId,
      serverEntry,
      approvals: parseApprovals(record["approvals"], serverId, `${label}.approvals`),
    });
  });
  return Object.freeze(servers);
}

/**
 * Reads all local-development MCP Servers from trusted process configuration.
 * Discovery never grants approval: every Tool and Schema digest must be pinned explicitly.
 */
export function readDevelopmentMcpDeploymentConfig(
  environment: NodeJS.ProcessEnv,
  nodeExecutable: string,
): DevelopmentMcpDeploymentConfig | undefined {
  const isConfigured = ["MCP_DEVELOPMENT_STDIO", "MCP_SERVERS"].some(
    (name) => optionalEnv(environment, name) !== undefined,
  );
  if (!isConfigured) return undefined;
  if (requireEnv(environment, "MCP_DEVELOPMENT_STDIO") !== "true") {
    throw new Error("MCP_DEVELOPMENT_STDIO must be 'true' for the local stdio transport.");
  }
  if (optionalEnv(environment, "NODE_ENV") === "production") {
    throw new Error("stdio MCP transport is forbidden when NODE_ENV=production.");
  }
  if (!isAbsolute(nodeExecutable)) throw new Error("The Node.js executable path must be absolute.");
  return Object.freeze({
    nodeExecutable,
    servers: parseServers(requireEnv(environment, "MCP_SERVERS")),
  });
}

async function connectApprovedDevelopmentMcp(
  config: DevelopmentMcpServerConfig,
  nodeExecutable: string,
): Promise<ConnectedMcpServer> {
  let connection: McpClientConnection | undefined;
  try {
    connection = await connectDevelopmentStdioMcp({
      developmentOnly: true,
      serverId: config.serverId,
      command: nodeExecutable,
      args: [config.serverEntry],
    });
    const candidates = await discoverMcpTools(connection.client, { serverId: config.serverId });
    const snapshot = createApprovedMcpToolSnapshot(candidates, config.approvals);
    if (snapshot.unapproved.length > 0) {
      throw new Error(
        `MCP Server '${config.serverId}' exposed ${snapshot.unapproved.length} unapproved Tool(s).`,
      );
    }
    const tools = Object.freeze(
      createMcpLangChainTools({ client: connection.client, approvedTools: snapshot.approved }),
    );
    const serverStatus = Object.freeze({
      serverId: config.serverId,
      status: "ready",
      transport: "stdio",
      protocolEra: connection.protocolEra,
      approvedToolCount: snapshot.approved.length,
    });
    const toolStatuses = Object.freeze(
      snapshot.approved.map((tool) =>
        Object.freeze({
          serverId: tool.serverId,
          toolName: tool.name,
          schemaDigest: tool.schemaDigest,
          riskLevel: tool.riskLevel,
          status: "approved",
        }),
      ),
    );
    let closed = false;
    return Object.freeze({
      tools,
      serverStatus,
      toolStatuses,
      close: async () => {
        if (closed) return;
        closed = true;
        await connection?.close();
      },
    });
  } catch (error) {
    await connection?.close();
    throw error;
  }
}

export async function connectApprovedDevelopmentMcps(
  config: DevelopmentMcpDeploymentConfig,
): Promise<ConfiguredMcpRuntime> {
  let connections: readonly ConnectedMcpServer[] = [];
  try {
    for (const server of config.servers) {
      const connection = await connectApprovedDevelopmentMcp(server, config.nodeExecutable);
      connections = [...connections, connection];
    }
    const tools = Object.freeze(connections.flatMap((connection) => connection.tools));
    const toolNames = new Set<string>();
    for (const tool of tools) {
      if (toolNames.has(tool.name)) {
        throw new Error(`MCP model Tool name conflict for '${tool.name}'.`);
      }
      toolNames.add(tool.name);
    }
    const serverStatuses = Object.freeze(connections.map((connection) => connection.serverStatus));
    const toolStatuses = Object.freeze(
      connections.flatMap((connection) => connection.toolStatuses),
    );
    let closed = false;
    return Object.freeze({
      tools,
      serverStatuses,
      toolStatuses,
      close: async () => {
        if (closed) return;
        closed = true;
        await Promise.all(connections.map((connection) => connection.close()));
      },
    });
  } catch (error) {
    await Promise.allSettled(connections.map((connection) => connection.close()));
    throw error;
  }
}
