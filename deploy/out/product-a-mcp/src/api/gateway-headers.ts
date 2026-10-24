/**
 * 统一网关 HTTP 头策略：从 MCP 入站请求筛选自定义头，并在出站时与 Bearer 一并组装。
 * 避免把网关 Token 或租户信息写进 Tool 参数或日志。
 */
import type { ProductARequestContext } from "./types.js";

/** 未配置 `PRODUCT_A_MCP_FORWARD_HEADER_PREFIXES` 时的默认白名单前缀。 */
const DEFAULT_FORWARD_PREFIXES = ["x-product-a-"];

/**
 * 从入站 HTTP 请求提取允许转发到统一网关的自定义头（小写键名）。
 */
export function readForwardHeadersFromRequest(request?: Request): Readonly<Record<string, string>> {
  if (request === undefined) {
    return {};
  }

  const prefixes =
    process.env["PRODUCT_A_MCP_FORWARD_HEADER_PREFIXES"]?.split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0) ?? DEFAULT_FORWARD_PREFIXES;

  const headers: Record<string, string> = {};
  for (const [name, value] of request.headers.entries()) {
    const lower = name.toLowerCase();
    if (prefixes.some((prefix) => lower.startsWith(prefix))) {
      headers[lower] = value;
    }
  }
  return headers;
}

/** 组装调用 Product A 统一网关时的 HTTP 头（Token 不进 Tool 参数）。 */
export function buildProductAGatewayHeaders(
  ctx: ProductARequestContext,
): Readonly<Record<string, string>> {
  return {
    Authorization: `Bearer ${ctx.gatewayAccessToken}`,
    "X-Tenant-Id": ctx.tenantId,
    "X-Subject-Id": ctx.subjectId,
    ...ctx.forwardHeaders,
  };
}
