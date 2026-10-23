import { DynamicStructuredTool } from "@langchain/core/tools";

import type { ApprovedMcpTool } from "./tool-discovery.js";
import type { McpClientPort, McpJsonObjectSchema } from "./types.js";

export class McpToolInvocationError extends Error {
  constructor(
    readonly code:
      | "MCP_TOOL_ERROR"
      | "MCP_STRUCTURED_CONTENT_REQUIRED"
      | "MCP_RESULT_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "McpToolInvocationError";
  }
}

export interface CreateMcpLangChainToolsOptions {
  readonly client: McpClientPort;
  readonly approvedTools: readonly ApprovedMcpTool[];
  readonly callTimeoutMs?: number;
  readonly maxResultBytes?: number;
  readonly invokeTool?: (
    request: Parameters<McpClientPort["callTool"]>[0],
    options: NonNullable<Parameters<McpClientPort["callTool"]>[1]>,
    context: unknown,
  ) => ReturnType<McpClientPort["callTool"]>;
}

function modelToolName(serverId: string, toolName: string): string {
  const normalized = `mcp_${serverId}_${toolName}`.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  if (normalized.length > 128) throw new Error(`MCP model Tool name is too long: '${normalized}'.`);
  return normalized;
}

function resultBytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new McpToolInvocationError(
      "MCP_STRUCTURED_CONTENT_REQUIRED",
      "MCP Tool returned non-JSON structured content.",
    );
  }
  return Buffer.byteLength(serialized, "utf8");
}

export function createMcpLangChainTools(options: CreateMcpLangChainToolsOptions) {
  const names = new Set<string>();
  return options.approvedTools.map((approved) => {
    const name = modelToolName(approved.serverId, approved.name);
    if (names.has(name)) throw new Error(`MCP model Tool name conflict for '${name}'.`);
    names.add(name);

    return new DynamicStructuredTool<
      McpJsonObjectSchema,
      Record<string, unknown>,
      Record<string, unknown>,
      unknown
    >({
      name,
      description: approved.description,
      schema: approved.inputSchema,
      func: async (input, _runManager, config) => {
        const invoke: NonNullable<CreateMcpLangChainToolsOptions["invokeTool"]> = options.invokeTool
          ?? ((request, callOptions) => options.client.callTool(request, callOptions));
        const result = await invoke(
          { name: approved.name, arguments: input },
          {
            timeout: options.callTimeoutMs ?? 30_000,
            toolDefinition: approved.definition,
            ...(config?.signal === undefined ? {} : { signal: config.signal }),
          },
          (config as unknown as { context?: unknown } | undefined)?.context,
        );
        if (result.isError === true) {
          throw new McpToolInvocationError(
            "MCP_TOOL_ERROR",
            `MCP Tool '${approved.serverId}/${approved.name}' returned an execution error.`,
          );
        }
        if (result.structuredContent === undefined) {
          throw new McpToolInvocationError(
            "MCP_STRUCTURED_CONTENT_REQUIRED",
            `MCP Tool '${approved.serverId}/${approved.name}' did not return structured content.`,
          );
        }
        if (resultBytes(result.structuredContent) > (options.maxResultBytes ?? 256 * 1024)) {
          throw new McpToolInvocationError(
            "MCP_RESULT_TOO_LARGE",
            `MCP Tool '${approved.serverId}/${approved.name}' exceeded the result size limit.`,
          );
        }
        return result.structuredContent;
      },
    });
  });
}
