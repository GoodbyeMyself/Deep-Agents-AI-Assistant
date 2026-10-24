/** 验证 HTTP Bearer → `ProductARequestContext` 映射（不启动 HTTP 服务）。 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveProductARequestContext } from "../dist/api/auth-context.js";
import { verifyLocalDelegation } from "../dist/http/verify-bearer.js";
import { productAAuthFromToolContext } from "../dist/tools/auth-from-context.js";
import { createHmac } from "node:crypto";

test("resolveProductARequestContext maps Bearer token to gateway access token", () => {
  const context = resolveProductARequestContext({
    signal: AbortSignal.timeout(1000),
    authInfo: {
      token: "gateway-token-abc",
      clientId: "platform",
      scopes: ["read"],
      extra: { subjectId: "user-9", tenantId: "tenant-1" },
    },
    request: new Request("http://127.0.0.1/mcp", {
      headers: {
        "X-Product-A-Trace": "trace-1",
      },
    }),
  });

  assert.equal(context.gatewayAccessToken, "gateway-token-abc");
  assert.equal(context.subjectId, "user-9");
  assert.equal(context.tenantId, "tenant-1");
  assert.equal(context.forwardHeaders["x-product-a-trace"], "trace-1");
});

test("local delegation validates signature, audience, expiry and discovery scope", () => {
  const secret = "test-secret-".repeat(8);
  const now = Math.floor(Date.now() / 1000);
  function sign(overrides = {}) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "assistant-local", aud: "product-a-mcp", sub: "user-one",
      tenant: "tenant-one", iat: now, exp: now + 60, purpose: "tool", ...overrides })).toString("base64url");
    return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
  }
  const valid = verifyLocalDelegation(sign(), secret, now);
  assert.equal(valid.extra.subjectId, "user-one");
  assert.equal(valid.extra.tenantId, "tenant-one");
  assert.equal(verifyLocalDelegation(sign(), "wrong-secret".repeat(8), now), undefined);
  for (const overrides of [{ aud: "other-mcp" }, { exp: now }, { exp: now + 300 }, { iat: now + 30 }, { purpose: "admin" }])
    assert.equal(verifyLocalDelegation(sign(overrides), secret, now), undefined);
  const discovery = verifyLocalDelegation(sign({ purpose: "discovery" }), secret, now);
  assert.throws(() => productAAuthFromToolContext({ mcpReq: { signal: AbortSignal.timeout(1000) }, http: { authInfo: discovery } }), /Discovery credentials/);
});
