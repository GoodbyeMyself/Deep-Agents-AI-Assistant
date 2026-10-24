import type { AuthInfo } from "@modelcontextprotocol/server";

/**
 * 单次 MCP Tool 调用的可信认证来源。
 *
 * - Streamable HTTP：`authInfo` 由 `http/verify-bearer` 解析 Bearer 后，经 `handler.fetch` 传入；
 *   `request` 为原始 Web Request，用于提取可转发的自定义头。
 * - stdio：通常两者皆无，由 `auth-context` 回退到开发环境变量。
 *
 * 从 `tools/auth-from-context` 构造，再传入各 `services/*`。
 */
export interface ProductAAuthSource {
  /** MCP 请求取消信号，须向下传递到 `fetch` 与微服务 client。 */
  readonly signal: AbortSignal;
  /** SDK 校验后的访问令牌；`token` 字段即转发统一网关的 Bearer。 */
  readonly authInfo?: AuthInfo;
  readonly request?: Request;
}
