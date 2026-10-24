/** Platform-owned execution policy. MCP declarations cannot disable user confirmation. */
export const MCP_TOOL_EXECUTION_POLICY = Object.freeze({
  version: "1",
  read: "execute",
  write: "confirm",
  destructive: "confirm",
} as const);

export type McpToolRiskLevel = "read" | "write" | "destructive";
export type McpToolExecutionDecision = "execute" | "confirm";

/** Unknown or missing risk fails closed, including callers outside the discovery pipeline. */
export function resolveMcpToolExecutionDecision(risk: unknown): McpToolExecutionDecision {
  if (risk !== "read" && risk !== "write" && risk !== "destructive")
    throw new Error("MCP Tool risk is missing or unsupported by platform policy.");
  return MCP_TOOL_EXECUTION_POLICY[risk];
}
