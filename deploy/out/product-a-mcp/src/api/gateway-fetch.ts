import { buildProductAGatewayHeaders } from "./gateway-headers.js";
import type { ProductARequestContext } from "./types.js";

/**
 * 经统一网关访问下游微服务的 fetch 封装（接真 API 时使用）。
 * Mock 阶段 clients 可不调用本函数。
 */
export async function gatewayFetch(
  ctx: ProductARequestContext,
  path: string,
  init: RequestInit & { signal: AbortSignal },
): Promise<Response> {
  const baseUrl = process.env["PRODUCT_A_GATEWAY_BASE_URL"];
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new Error("PRODUCT_A_GATEWAY_BASE_URL is not configured.");
  }

  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(buildProductAGatewayHeaders(ctx))) {
    headers.set(name, value);
  }

  return fetch(url, {
    ...init,
    headers,
    signal: init.signal,
  });
}
