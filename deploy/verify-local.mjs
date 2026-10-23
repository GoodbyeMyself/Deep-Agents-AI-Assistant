// Real local deployment acceptance. Does not invoke pnpm or read model credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://127.0.0.1:3411/api/v1";
const stateFile = new URL("./acceptance-state.local", import.meta.url);
async function api(path, body, token = "mock-token-admin") {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-assistant-mode": "standalone" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`API ${path} returned ${response.status}/${result.code ?? "unknown"}`);
  return result;
}
async function run(sessionId, contextSnapshotId, message) {
  const created = await api(`/sessions/${sessionId}/runs`, { contextSnapshotId, message, clientRequestId: randomUUID() });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const current = await api(`/runs/${created.runId}`);
    if (["failed", "cancelled", "interrupted"].includes(current.status))
      throw new Error(`Run ended as ${current.status}/${current.errorCode ?? "unknown"}`);
    if (current.status === "completed") return created.runId;
    await delay(1_000);
  }
  throw new Error("Run acceptance timed out.");
}
async function events(runId) {
  const response = await fetch(`${base}/runs/${runId}/events`, {
    headers: { authorization: "Bearer mock-token-admin" }, signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  return (await response.text()).split("\n").filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

const stage = process.argv[2];
if (stage === "before") {
  for (const port of [5411, 5511, 8080]) {
    assert.equal((await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) })).status, 200);
  }
  const loader = await fetch("http://127.0.0.1:5511/assistant-loader.js", { signal: AbortSignal.timeout(5_000) });
  assert.equal(loader.status, 200);
  assert.equal(loader.headers.get("access-control-allow-origin"), "http://127.0.0.1:5411");
  const servers = await api("/mcp/servers");
  assert.ok(servers.items.some((server) => server.transport === "streamable-http" && server.status === "ready"));
  const snapshot = await api("/context/snapshots", {});
  const session = await api("/sessions", { mode: "standalone", title: "Docker 持久化验收" });
  const phrase = `docker-${randomUUID()}`;
  const runId = await run(session.id, snapshot.id,
    `本次部署验收口令是 ${phrase}。请记住，我接下来会问你这个口令。现在只回复已记住，不调用工具。`);
  const initial = await events(runId);
  assert.equal(initial.at(-1).type, "run.completed");
  const isolated = await fetch(`${base}/sessions/${session.id}`, { headers: { authorization: "Bearer mock-token-user-b" } });
  assert.equal(isolated.status, 404);
  writeFileSync(stateFile, JSON.stringify({ sessionId: session.id, snapshotId: snapshot.id, phrase, firstRunId: runId }));
  console.log(JSON.stringify({ stage, passed: true, frontendPorts: [5411, 5511, 8080], sessionId: session.id, firstRunId: runId }));
} else if (stage === "after") {
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const prior = await api(`/sessions/${state.sessionId}/messages`);
  assert.ok(prior.items.some((message) => message.runId === state.firstRunId && message.role === "assistant"));
  assert.equal((await events(state.firstRunId)).at(-1).type, "run.completed");
  const runId = await run(state.sessionId, state.snapshotId,
    "我上一条消息中给出的部署验收口令是什么？只回复口令，不调用任何工具。");
  const history = await api(`/sessions/${state.sessionId}/messages`);
  assert.ok(history.items.some((message) => message.runId === runId && message.role === "assistant" && message.content.includes(state.phrase)),
    "The actual model did not recover the prior conversation's acceptance phrase.");
  state.secondRunId = runId;
  writeFileSync(stateFile, JSON.stringify(state));
  console.log(JSON.stringify({ stage, passed: true, sessionId: state.sessionId, modelMemoryRecovered: true }));
} else if (stage === "business") {
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const snapshot = await api("/context/snapshots", { object: { rawId: "orders", type: "data_table", name: "订单明细表" } });
  const runId = await run(state.sessionId, snapshot.id,
    "请调用 get_table_metadata 工具查询当前 orders 表的元数据，并简要列出字段和来源证据。这是 Mock 业务数据的接入验收。");
  const observed = await events(runId);
  assert.ok(observed.some((event) => event.type === "tool.completed"));
  assert.ok(observed.some((event) => event.type === "evidence.added"));
  const history = await api(`/sessions/${state.sessionId}/messages`);
  const answer = history.items.find((message) => message.runId === runId && message.role === "assistant");
  assert.ok(answer.evidenceRefs.length > 0);
  for (const reference of answer.evidenceRefs) await api(`/evidence/${encodeURIComponent(reference)}`);
  state.businessRunId = runId;
  writeFileSync(stateFile, JSON.stringify(state));
  console.log(JSON.stringify({ stage, passed: true, httpMcpInvoked: true, mockBusinessData: true, evidenceResolved: true, runId }));
} else throw new Error("Use before, after or business. The after stage requires recreating Agent Server between stages.");
