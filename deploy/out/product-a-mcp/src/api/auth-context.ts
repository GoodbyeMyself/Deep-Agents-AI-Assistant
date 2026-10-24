import type { ProductAAuthSource } from "./auth-source.js";
import { readForwardHeadersFromRequest } from "./gateway-headers.js";
import type { ProductARequestContext } from "./types.js";

function readStringExtra(extra: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = extra?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * 从 MCP HTTP 认证结果恢复 Product A 请求上下文。
 * - Streamable HTTP：平台在 `Authorization: Bearer` 传入委托 Token（通常即统一网关 Token）。
 * - stdio 本地：无 authInfo 时使用 `PRODUCT_A_DEV_GATEWAY_TOKEN` 或占位 Token（仅开发）。
 */
export function resolveProductARequestContext(source: ProductAAuthSource): ProductARequestContext {
  source.signal.throwIfAborted();

  const authInfo = source.authInfo;
  const extra = authInfo?.extra;
  // HTTP：平台传入的 Bearer 即统一网关 Token（同一凭证贯穿 MCP → 网关 → 微服务）。
  const gatewayAccessToken =
    authInfo?.token ??
    process.env["PRODUCT_A_DEV_GATEWAY_TOKEN"] ??
    "product-a-local-dev-token";

  const subjectId =
    readStringExtra(extra, "subjectId") ??
    source.request?.headers.get("x-subject-id") ??
    "mock-subject-001";

  const tenantId =
    readStringExtra(extra, "tenantId") ??
    source.request?.headers.get("x-tenant-id") ??
    "mock-tenant-east";

  return {
    subjectId,
    tenantId,
    gatewayAccessToken,
    forwardHeaders: readForwardHeadersFromRequest(source.request),
  };
}
