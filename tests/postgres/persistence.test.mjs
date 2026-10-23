import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createPostgresStorage } from "../../apps/agent-server/dist/index.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required; use a dedicated local test database.");
if (!new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Persistence tests require a dedicated database with a name ending in _test.");

test("PostgreSQL commits sessions/events/audit/checkpoints and preserves isolation after reopen", async () => {
  const principal = { id: `test-${randomUUID()}`, tenantId: `test-${randomUUID()}`, displayName: "Persistence test",
    permissionScopes: [], authorizedObjectIds: ["object-1"], authorizationRef: "test" };
  const other = { ...principal, id: `other-${randomUUID()}` };
  const otherTenant = { ...principal, tenantId: `other-${randomUUID()}` };
  let storage = await createPostgresStorage(databaseUrl, "test@1");
  let threadId;
  let sessionId;
  const snapshotId = randomUUID();
  try {
    await assert.rejects(createPostgresStorage(databaseUrl, "test@1"), /runner lease/);
    const session = await storage.store.createSession(principal, "standalone", "Durable conversation");
    sessionId = session.id;
    threadId = session.threadId;
    await storage.store.saveSnapshot({ id: snapshotId, version: 1, ownerId: principal.id, tenantId: principal.tenantId,
      mode: "standalone", capturedAt: new Date().toISOString(), context: { user: { id: principal.id }, permissions: { scopes: [] } } });
    const input = { principal, sessionId, contextSnapshotId: snapshotId, clientRequestId: randomUUID(), message: "Remember this conversation" };
    const results = await Promise.all([storage.store.createRun(input), storage.store.createRun(input)]);
    assert.equal(results.filter((value) => value.created).length, 1);
    assert.equal(results[0].run.id, results[1].run.id);
    const run = results[0].run;
    await assert.rejects(storage.store.createRun({ ...input, clientRequestId: randomUUID() }), { code: "RUN_CONFLICT" });
    await assert.rejects(storage.store.requireSession(sessionId, other), { code: "NOT_FOUND" });
    await assert.rejects(storage.store.requireRun(run.id, otherTenant), { code: "NOT_FOUND" });
    await storage.store.setRunStatus(run.id, "running");
    const events = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      storage.store.appendEvent(run.id, "message.delta", { delta: `part-${index}` })));
    assert.deepEqual(events.map((event) => event.sequence).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
    await storage.store.addMessage({ sessionId, runId: run.id, role: "assistant", content: "Durable reply", evidenceRefs: [] });
    const referenceId = `ref-${randomUUID()}`;
    await storage.store.addEvidence(run, { id: randomUUID(), referenceId, source: { type: "record", id: "object-1" }, collectedAt: new Date().toISOString() });
    await storage.store.finishRun(run.id, "completed", { evidenceRefs: [referenceId] });
    const config = { configurable: { thread_id: threadId, checkpoint_ns: "" } };
    await storage.checkpointer.put(config, { v: 4, id: randomUUID(), ts: new Date().toISOString(),
      channel_values: { messages: ["durable memory"] }, channel_versions: { messages: 1 }, versions_seen: {} },
      { source: "input", step: -1, parents: {} }, { messages: 1 });
    const unfinished = await storage.store.createRun({ ...input, clientRequestId: randomUUID(), message: "Interrupted by restart" });
    await storage.store.setRunStatus(unfinished.run.id, "running");
    await storage.close();
    storage = await createPostgresStorage(databaseUrl, "test@1");
    assert.equal((await storage.store.requireSession(sessionId, principal)).threadId, threadId);
    assert.equal((await storage.store.listMessages(sessionId, principal)).filter((message) => message.role === "assistant")[0].content, "Durable reply");
    const replay = await storage.store.listEvents(run.id, principal, `${run.id}:3`);
    assert.deepEqual(replay.map((event) => event.sequence), [4, 5, 6, 7]);
    await assert.rejects(storage.store.listEvents(run.id, principal, "unknown"), { code: "EVENT_CURSOR_EXPIRED" });
    assert.equal((await storage.store.getEvidence(referenceId, principal)).source.id, "object-1");
    assert.equal((await storage.store.requireRun(unfinished.run.id, principal)).errorCode, "SERVER_RESTARTED");
    assert.equal((await storage.store.listEvents(unfinished.run.id, principal)).at(-1).type, "run.failed");
    assert.deepEqual((await storage.checkpointer.getTuple(config)).checkpoint.channel_values.messages, ["durable memory"]);
    const audit = await storage.store.pool.query("SELECT action FROM assistant.audit_events WHERE tenant_id=$1", [principal.tenantId]);
    assert.ok(audit.rows.some((row) => row.action === "session.created"));
    assert.ok(audit.rows.some((row) => row.action === "run.completed"));
    await assert.rejects(storage.store.requireSession(sessionId, otherTenant), { code: "NOT_FOUND" });
  } finally {
    // Delete only this test's random tenant and thread, never shared schema or volumes.
    if (threadId) await storage.checkpointer.deleteThread(threadId);
    if (sessionId) {
      const db = storage.store.pool;
      await db.query("DELETE FROM assistant.evidence WHERE tenant_id=$1", [principal.tenantId]);
      await db.query("DELETE FROM assistant.events WHERE run_id IN (SELECT id FROM assistant.runs WHERE tenant_id=$1)", [principal.tenantId]);
      await db.query("DELETE FROM assistant.messages WHERE session_id=$1", [sessionId]);
      await db.query("DELETE FROM assistant.interrupts WHERE session_id=$1", [sessionId]);
      await db.query("DELETE FROM assistant.runs WHERE tenant_id=$1", [principal.tenantId]);
      await db.query("DELETE FROM assistant.sessions WHERE id=$1", [sessionId]);
    }
    await storage.store.pool.query("DELETE FROM assistant.context_snapshots WHERE tenant_id=$1", [principal.tenantId]);
    await storage.store.pool.query("DELETE FROM assistant.audit_events WHERE tenant_id=$1", [principal.tenantId]);
    await storage.close();
  }
});
