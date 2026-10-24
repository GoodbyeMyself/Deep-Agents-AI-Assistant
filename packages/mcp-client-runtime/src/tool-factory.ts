import { resolveMcpToolExecutionDecision } from "./tool-execution-policy.js";
import { DynamicStructuredTool } from "@langchain/core/tools";

import type { ApprovedMcpTool } from "./tool-discovery.js";
import type { McpClientPort, McpJsonObjectSchema } from "./types.js";

export class McpToolInvocationError extends Error {
  constructor(
    readonly code:
      | "MCP_TOOL_ERROR"
      | "MCP_BUSINESS_REJECTED"
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
  /** Must interrupt for a persisted user decision before returning a stable invocation key. */
  readonly approveWrite?: (
    tool: ApprovedMcpTool,
    input: Record<string, unknown>,
    context: unknown,
    toolCallId: string,
  ) => string;
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
  for (const approved of options.approvedTools) {
    if (resolveMcpToolExecutionDecision(approved.riskLevel) === "confirm" && !options.approveWrite)
      throw new Error("Platform confirmation handler is required before exposing MCP write Tools.");
  }
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
        const invoke: NonNullable<CreateMcpLangChainToolsOptions["invokeTool"]> =
          options.invokeTool ??
          ((request, callOptions) => options.client.callTool(request, callOptions));
        const runtime = config as unknown as
          | { context?: unknown; toolCall?: { id?: string } }
          | undefined;
        let writeKey: string | undefined;
        config?.signal?.throwIfAborted();
        if (resolveMcpToolExecutionDecision(approved.riskLevel) === "confirm") {
          if (!options.approveWrite || !runtime?.toolCall?.id)
            throw new Error(
              "MCP write requires a governed approval handler and Tool call identity.",
            );
          writeKey = options.approveWrite(approved, input, runtime.context, runtime.toolCall.id);
          if (!/^[a-f0-9]{64}$/.test(writeKey))
            throw new Error("Invalid platform confirmation receipt.");
        }
        config?.signal?.throwIfAborted();
        const result = await invoke(
          {
            name: approved.name,
            arguments: input,
            ...(writeKey === undefined
              ? {}
              : { _meta: { "com.deep-agents.platform/write-key": writeKey } }),
          },
          {
            timeout: options.callTimeoutMs ?? 30_000,
            toolDefinition: approved.definition,
            ...(config?.signal === undefined ? {} : { signal: config.signal }),
          },
          (config as unknown as { context?: unknown } | undefined)?.context,
        );
        if (result.isError === true) {
          const error = result._meta?.["com.deep-agents.platform/public-error"];
          if (error && typeof error === "object" && !Array.isArray(error)) {
            const value = error as Record<string, unknown>;
            if (
              typeof value["code"] === "string" &&
              /^[A-Z][A-Z0-9_]{0,79}$/.test(value["code"]) &&
              typeof value["message"] === "string" &&
              value["message"].trim().length > 0 &&
              value["message"].length <= 500 &&
              // eslint-disable-next-line no-control-regex -- Explicitly reject control characters in public display text.
              !/[\u0000-\u001f\u007f]/.test(value["message"])
            )
              throw new McpToolInvocationError("MCP_BUSINESS_REJECTED", value["message"]);
          }
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
