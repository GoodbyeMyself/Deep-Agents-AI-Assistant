/**
 * MCP HTTP 边的 Bearer 解析（Resource Server 侧）。
 *
 * 注意：SDK `createMcpHandler` 本身不校验 Token；本模块在 `node-server` 中于
 * 调用 `handler.fetch` 前执行。生产应替换为 JWT 验签或与主平台一致的令牌内省，
 * 并将 claims 写入 `authInfo.extra`（如 subjectId、tenantId）。
 */
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Local demo only: authenticated claims, 60-second validity and a fixed MCP audience. */
export function verifyLocalDelegation(token: string, secret: string, now = Math.floor(Date.now() / 1000)): AuthInfo | undefined {
  try {
    if (secret.length < 64 || token.length > 4096) return undefined;
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const [header, payload, signature] = parts as [string, string, string];
    const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined;
    const algorithm = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Record<string, unknown>;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (algorithm["alg"] !== "HS256" || algorithm["typ"] !== "JWT" || claims["iss"] !== "assistant-local"
      || claims["aud"] !== "product-a-mcp" || typeof claims["sub"] !== "string" || !claims["sub"]
      || typeof claims["tenant"] !== "string" || !claims["tenant"]
      || typeof claims["exp"] !== "number" || typeof claims["iat"] !== "number"
      || claims["exp"] <= now || claims["iat"] > now + 5 || claims["exp"] - claims["iat"] > 60
      || claims["exp"] <= claims["iat"] || !["tool", "discovery"].includes(String(claims["purpose"]))) return undefined;
    return { token, clientId: "assistant-local", scopes: [String(claims["purpose"])], expiresAt: claims["exp"],
      extra: { subjectId: claims["sub"], tenantId: claims["tenant"], purpose: claims["purpose"] } };
  } catch { return undefined; }
}

function parseBearerToken(authorization: string | null): string | undefined {
  if (authorization === null) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  return token !== undefined && token.length > 0 ? token : undefined;
}

/**
 * 将入站 `Authorization: Bearer` 转为 MCP `authInfo`（pass-through 给 handler）。
 * 生产应替换为 JWT 校验 / 令牌内省；此处支持开发期固定 Token 比对。
 */
export function resolveAuthInfoFromRequest(request: Request): AuthInfo | undefined {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (token === undefined) {
    return undefined;
  }
  if (process.env["PRODUCT_A_LOCAL_DEMO"] === "true")
    return verifyLocalDelegation(token, process.env["PRODUCT_A_MCP_DELEGATION_SECRET"] ?? "");

  const expected = process.env["PRODUCT_A_MCP_EXPECTED_BEARER"];
  if (!expected || token !== expected || process.env["NODE_ENV"] === "production") {
    return undefined;
  }

  const subjectId = request.headers.get("x-subject-id") ?? "mock-subject-001";
  const tenantId = request.headers.get("x-tenant-id") ?? "mock-tenant-east";

  return {
    token,
    clientId: request.headers.get("x-mcp-client-id") ?? "product-a-platform",
    scopes: ["read"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: {
      subjectId,
      tenantId,
    },
  };
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="product-a-mcp"',
    },
  });
}
