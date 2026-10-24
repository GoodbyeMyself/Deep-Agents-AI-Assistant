import type { McpToolRiskLevel } from "./tool-execution-policy.js";
import { createHash } from "node:crypto";

import type { Tool } from "@modelcontextprotocol/client";

import {
  PLATFORM_GOVERNANCE_META_KEY,
  type McpClientPort,
  type McpJsonObjectSchema,
} from "./types.js";

export interface McpToolCandidate {
  readonly serverId: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: McpJsonObjectSchema;
  readonly outputSchema: McpJsonObjectSchema;
  readonly schemaDigest: string;
  readonly riskLevel: McpToolRiskLevel;
  readonly definition: Tool;
}

export interface McpToolApproval {
  readonly serverId: string;
  readonly toolName: string;
  readonly schemaDigest: string;
  readonly riskLevel: McpToolRiskLevel;
}

export type ApprovedMcpTool = McpToolCandidate;

export interface McpToolSnapshot {
  readonly approved: readonly ApprovedMcpTool[];
  readonly unapproved: readonly McpToolCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObjectSchema(value: unknown, label: string): McpJsonObjectSchema {
  if (!isRecord(value) || value["type"] !== "object") {
    throw new Error(`${label} must be an object JSON Schema.`);
  }
  return value as McpJsonObjectSchema;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("MCP Schema contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`MCP Schema contains a non-JSON value of type '${typeof value}'.`);
}

function schemaDigest(inputSchema: McpJsonObjectSchema, outputSchema: McpJsonObjectSchema): string {
  return createHash("sha256")
    .update(canonicalJson({ inputSchema, outputSchema }), "utf8")
    .digest("hex");
}

function governedRisk(tool: Tool): "read" | "write" | "destructive" {
  const governance = tool._meta?.[PLATFORM_GOVERNANCE_META_KEY];
  if (!isRecord(governance) || governance["protocolVersion"] !== "1")
    throw new Error("Invalid MCP governance metadata.");
  const risk = governance["riskLevel"];
  if (
    risk === "read" &&
    tool.annotations?.readOnlyHint === true &&
    tool.annotations?.destructiveHint !== true
  )
    return risk;
  if (
    (risk === "write" || risk === "destructive") &&
    tool.annotations?.readOnlyHint === false &&
    tool.annotations?.destructiveHint === (risk === "destructive")
  )
    return risk;
  throw new Error(`MCP Tool '${tool.name}' has inconsistent governance risk annotations.`);
}

function validateServerId(serverId: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(serverId)) {
    throw new Error(`Invalid MCP server id '${serverId}'.`);
  }
}

export async function discoverMcpTools(
  client: McpClientPort,
  options: { serverId: string; timeoutMs?: number },
): Promise<readonly McpToolCandidate[]> {
  validateServerId(options.serverId);
  const { tools } = await client.listTools(undefined, { timeout: options.timeoutMs ?? 10_000 });
  const names = new Set<string>();
  const candidates = tools.map((definition) => {
    if (names.has(definition.name)) throw new Error(`Duplicate MCP Tool '${definition.name}'.`);
    names.add(definition.name);
    const inputSchema = requireObjectSchema(
      definition.inputSchema,
      `MCP Tool '${definition.name}' inputSchema`,
    );
    const outputSchema = requireObjectSchema(
      definition.outputSchema,
      `MCP Tool '${definition.name}' outputSchema`,
    );
    const riskLevel = governedRisk(definition);
    return Object.freeze({
      serverId: options.serverId,
      name: definition.name,
      description: definition.description?.slice(0, 1_000) ?? definition.name,
      inputSchema,
      outputSchema,
      schemaDigest: schemaDigest(inputSchema, outputSchema),
      riskLevel,
      definition,
    });
  });
  return Object.freeze(candidates);
}

export function createApprovedMcpToolSnapshot(
  candidates: readonly McpToolCandidate[],
  approvals: readonly McpToolApproval[],
): McpToolSnapshot {
  const approvalByKey = new Map<string, McpToolApproval>();
  for (const approval of approvals) {
    const key = `${approval.serverId}\u0000${approval.toolName}`;
    if (approvalByKey.has(key))
      throw new Error(`Duplicate MCP Tool approval '${approval.toolName}'.`);
    approvalByKey.set(key, approval);
  }

  const approved: McpToolCandidate[] = [];
  const unapproved: McpToolCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.serverId}\u0000${candidate.name}`;
    const approval = approvalByKey.get(key);
    if (approval === undefined) {
      unapproved.push(candidate);
      continue;
    }
    if (
      approval.schemaDigest !== candidate.schemaDigest ||
      approval.riskLevel !== candidate.riskLevel
    ) {
      throw new Error(`MCP Tool approval drift for '${candidate.serverId}/${candidate.name}'.`);
    }
    approved.push(candidate);
    approvalByKey.delete(key);
  }

  if (approvalByKey.size > 0) {
    throw new Error(
      `Approved MCP Tool is missing: '${[...approvalByKey.keys()][0]?.split("\u0000").join("/")}'.`,
    );
  }

  return Object.freeze({
    approved: Object.freeze(approved),
    unapproved: Object.freeze(unapproved),
  });
}
