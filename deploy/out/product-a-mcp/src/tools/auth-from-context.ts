/**
 * 桥接 MCP SDK Tool 上下文与内部 `ProductAAuthSource`。
 * `context.http.authInfo` 仅在 Streamable HTTP 且入口传入 `authInfo` 时存在。
 */
import type { ProductAAuthSource } from "../api/auth-source.js";

/** 从 MCP Tool handler 上下文提取 HTTP 认证信息（stdio 下通常无 authInfo）。 */
export function productAAuthFromToolContext(context: {
  mcpReq: { signal: AbortSignal };
  http?: { authInfo?: ProductAAuthSource["authInfo"]; req?: Request };
}): ProductAAuthSource {
  if (context.http?.authInfo?.extra?.["purpose"] === "discovery")
    throw new Error("Discovery credentials cannot execute business Tools.");
  return {
    signal: context.mcpReq.signal,
    ...(context.http?.authInfo !== undefined ? { authInfo: context.http.authInfo } : {}),
    ...(context.http?.req !== undefined ? { request: context.http.req } : {}),
  };
}
