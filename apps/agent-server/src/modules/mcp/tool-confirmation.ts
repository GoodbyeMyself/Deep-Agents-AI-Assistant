import { createHash } from "node:crypto";
import { interrupt } from "@langchain/langgraph";
import {
  resolveMcpToolExecutionDecision,
  type ApprovedMcpTool,
} from "@assistant/mcp-client-runtime";

/** A deliberate user rejection stops the run without being treated as an execution failure. */
export class McpToolConfirmationCancelled extends Error {
  constructor() {
    super("Business operation was cancelled by the user.");
    this.name = "McpToolConfirmationCancelled";
  }
}

/** Uses the existing persisted LangGraph interrupt/resume contract; ordinary chat text cannot approve a write. */
export function requireMcpToolConfirmation(
  tool: ApprovedMcpTool,
  input: Record<string, unknown>,
  context: unknown,
  toolCallId: string,
): string {
  if (resolveMcpToolExecutionDecision(tool.riskLevel) !== "confirm")
    throw new Error("Read-only MCP Tools do not require user confirmation.");
  const identity = context as
    | { sessionId?: string; principalId?: string; tenantId?: string }
    | undefined;
  if (!identity?.sessionId || !identity.principalId || !identity.tenantId)
    throw new Error("Missing write identity.");
  const summary = JSON.stringify(input, null, 2);
  if (summary.length > 5000)
    throw new Error(
      "Write parameters exceed the approval display limit; use the original business page.",
    );
  const decision: unknown = interrupt({
    type: "approval",
    reason: "mcp_business_write",
    toolCallId,
    message: `请确认业务操作：${tool.serverId}/${tool.name}\n风险：${tool.riskLevel === "destructive" ? "删除不可恢复" : "写入业务数据"}\n参数：\n${summary}`,
  });
  if (
    decision &&
    typeof decision === "object" &&
    ((decision as Record<string, unknown>)["approved"] === false ||
      (decision as Record<string, unknown>)["__agui_cancelled__"] === true)
  )
    throw new McpToolConfirmationCancelled();
  if (
    !decision ||
    typeof decision !== "object" ||
    (decision as Record<string, unknown>)["approved"] !== true
  )
    throw new Error("Business operation was not approved.");
  return createHash("sha256")
    .update(
      JSON.stringify([identity.tenantId, identity.principalId, identity.sessionId, toolCallId]),
    )
    .digest("hex");
}
