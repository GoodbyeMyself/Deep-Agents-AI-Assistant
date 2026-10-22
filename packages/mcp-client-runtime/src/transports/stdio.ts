import { isAbsolute } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export interface DevelopmentStdioMcpConfig {
  readonly developmentOnly: true;
  readonly serverId: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly connectTimeoutMs?: number;
}

export interface McpClientConnection {
  readonly client: Client;
  readonly serverId: string;
  readonly protocolEra: "legacy" | "modern";
  close(): Promise<void>;
}

export async function connectDevelopmentStdioMcp(
  config: DevelopmentStdioMcpConfig,
): Promise<McpClientConnection> {
  if (!config.developmentOnly) throw new Error("stdio MCP is restricted to local development.");
  if (!isAbsolute(config.command)) {
    throw new Error("stdio MCP command must be an absolute executable path.");
  }
  if (config.cwd !== undefined && !isAbsolute(config.cwd)) {
    throw new Error("stdio MCP cwd must be an absolute path.");
  }

  const client = new Client({ name: "deep-agents-ai-assistant", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    args: [...(config.args ?? [])],
    ...(config.cwd === undefined ? {} : { cwd: config.cwd }),
  });
  await client.connect(transport, { timeout: config.connectTimeoutMs ?? 10_000 });
  const protocolEra = client.getProtocolEra();
  if (protocolEra === undefined) {
    await client.close();
    throw new Error("MCP protocol negotiation did not complete.");
  }
  return {
    client,
    serverId: config.serverId,
    protocolEra,
    close: () => client.close(),
  };
}
