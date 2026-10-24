// Read-only deployment health checks; never uses Mock identities or model keys.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const containers = execFileSync("docker", ["ps", "--format", "{{.Label \"com.docker.compose.project\"}}|{{.Label \"com.docker.compose.service\"}}"], { encoding: "utf8" }).trim().split(/\r?\n/);
for (const expected of ["assistant-product-a|web", "assistant-product-a|gateway", "assistant-mcp|product-a-mcp",
  "assistant-agents|postgres", "assistant-agents|agent-server", "assistant-agents|assistant-web", "assistant-agents|assistant-embed"])
  assert.ok(containers.includes(expected), `Missing running service: ${expected}`);
for (const url of ["http://127.0.0.1:19001", "http://127.0.0.1:19001/workplace",
  "http://127.0.0.1:19001/data-governance/data-source", "http://127.0.0.1:19002/user/login",
  "http://127.0.0.1:19002", "http://127.0.0.1:18080/actuator/health",
  "http://127.0.0.1:8080", "http://127.0.0.1:5511", "http://127.0.0.1:3411/api/v1/openapi.json"]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
  assert.equal(response.ok, true, `Unhealthy endpoint: ${url}`);
  await response.body?.cancel();
}
const unauthenticated = await fetch("http://127.0.0.1:3411/api/v1/sessions");
assert.equal(unauthenticated.status, 401);
console.log("Three deployment groups and unauthenticated rejection verified. Complete business and model acceptance in the signed-in Product A UI.");
