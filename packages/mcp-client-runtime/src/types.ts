import type { Client } from "@modelcontextprotocol/client";

export const PLATFORM_GOVERNANCE_META_KEY = "com.deep-agents.platform/governance";

export type McpClientPort = Pick<Client, "listTools" | "callTool" | "close">;

export interface McpJsonObjectSchema extends Record<string, unknown> {
  type: "object";
}
