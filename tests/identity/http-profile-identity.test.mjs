import assert from "node:assert/strict";
import test from "node:test";
import { HttpProfileIdentityProvider } from "../../apps/agent-server/dist/modules/identity/http-profile-identity.js";

const config = { endpoint: "http://127.0.0.1:8080/profile", allowedOrigin: "http://127.0.0.1:8080",
  cookieName: "test_cookie", tenantId: "deployment-test", localHttp: true, idPath: "data.id", displayNamePath: "data.name",
  rolePath: "data.role", statusPath: "data.status", activeStatus: "ACTIVE", adminRoles: ["ADMIN"] };

test("trusted cookie profile produces no plaintext credential and binds MCP to the same identity", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers.Authorization, "Bearer original-test-jwt");
    assert.equal(init.redirect, "error");
    return Response.json({ data: { id: 12, name: "Test User", role: "USER", status: "ACTIVE" } });
  });
  const provider = new HttpProfileIdentityProvider(config);
  const principal = await provider.authenticate(null, new Request("http://127.0.0.1:8080/api/v1/embed/tickets", {
    headers: { cookie: "test_cookie=original-test-jwt", origin: "http://127.0.0.1:8080" } }));
  assert.equal(principal.id, "12");
  assert.deepEqual(principal.permissionScopes, []);
  assert.ok(!JSON.stringify(principal).includes("original-test-jwt"));
  const opaque = provider.issueTemporaryCredential(principal);
  assert.equal((await provider.authenticate(`Bearer ${opaque}`)).id, "12");
  assert.equal(await provider.credentialFor({ principalId: "12", tenantId: config.tenantId, authorizationRef: principal.authorizationRef }), "original-test-jwt");
  await assert.rejects(provider.credentialFor({ principalId: "other", tenantId: config.tenantId, authorizationRef: principal.authorizationRef }));
});

test("cookie authentication blocks cross-origin mutations and disabled or expired upstream sessions", async (t) => {
  const provider = new HttpProfileIdentityProvider(config);
  await assert.rejects(provider.authenticate(null, new Request("http://127.0.0.1:8080/api/v1/embed/tickets", {
    headers: { cookie: "test_cookie=token", origin: "http://unapproved.example" } })));
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: { id: 12, name: "User", role: "ADMIN", status: "DISABLED" } }));
  await assert.rejects(provider.authenticate("Bearer token"));
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await assert.rejects(provider.authenticate("Bearer token"));
});

test("identity endpoint must match explicit deployment origin and transport", () => {
  assert.throws(() => new HttpProfileIdentityProvider({ ...config, allowedOrigin: "http://other.example" }));
  assert.throws(() => new HttpProfileIdentityProvider({ ...config, localHttp: false }));
});
