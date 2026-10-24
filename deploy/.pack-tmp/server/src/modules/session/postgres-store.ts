import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Pool, PoolClient } from "pg";
import type { ContextSnapshot, VerifiedPrincipal } from "@assistant/context";
import {
  assistantViewSchema,
  type AssistantEvent, type AssistantEventType, type AssistantInterrupt,
  type ResumeRunRequest,
} from "@assistant/contracts";
import { resolveEvidence, type Evidence, type EvidenceRecord } from "@assistant/evidence";
import { ServiceError, notFound } from "../../shared/errors.js";
import type { AgentStore } from "./agent-store.js";
import type { MessageRecord, PendingInterruptRecord, RunRecord, SessionRecord } from "./store.js";
import { POSTGRES_SCHEMA_V1 } from "./postgres-schema.js";

type Db = Pool | PoolClient;
const TERMINAL = new Set(["interrupted", "completed", "failed", "cancelled"]);

async function transaction<T>(pool: Pool, operation: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await operation(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally { db.release(); }
}

async function records<T>(db: Db, sql: string, values: readonly unknown[] = []): Promise<T[]> {
  const result = await db.query<{ record: T }>(sql, [...values]);
  return result.rows.map((row) => row.record);
}

async function audit(db: Db, principal: Pick<VerifiedPrincipal, "id" | "tenantId">,
  action: string, resourceId: string, outcome = "success"): Promise<void> {
  await db.query(
    "INSERT INTO assistant.audit_events(id,owner_id,tenant_id,action,resource_id,outcome) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), principal.id, principal.tenantId, action, resourceId, outcome],
  );
}

/** Durable single-runner store. No database operation falls back to process memory. */
export class PostgresAgentStore implements AgentStore {
  constructor(readonly pool: Pool, private readonly modelConfigVersion = "configured-model@1") {}

  async setup(): Promise<void> {
    await transaction(this.pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(74102831)");
      await db.query(POSTGRES_SCHEMA_V1);
    });
  }

  /** Called only after the deployment's exclusive runner lease has been acquired. */
  async recoverAbandonedRuns(): Promise<void> {
    await transaction(this.pool, async (db) => {
      const runs = await records<RunRecord>(db,
        "SELECT record FROM assistant.runs WHERE status IN ('queued','running') FOR UPDATE");
      for (const run of runs) {
        await this.updateStatus(db, run, "failed", "SERVER_RESTARTED");
        await this.writeEvent(db, run, "run.failed", {
          code: "SERVER_RESTARTED", message: "The server restarted; start a new run to continue.",
        });
      }
    });
  }

  async saveSnapshot(snapshot: ContextSnapshot): Promise<void> {
    await transaction(this.pool, async (db) => {
      await db.query(
        "INSERT INTO assistant.context_snapshots(id,owner_id,tenant_id,record) VALUES($1,$2,$3,$4)",
        [snapshot.id, snapshot.ownerId, snapshot.tenantId, JSON.stringify(snapshot)]);
      await audit(db, { id: snapshot.ownerId, tenantId: snapshot.tenantId }, "context.created", snapshot.id);
    });
  }

  async requireSnapshot(id: string, principal: VerifiedPrincipal): Promise<ContextSnapshot> {
    return this.snapshot(this.pool, id, principal);
  }

  private async snapshot(db: Db, id: string, principal: VerifiedPrincipal): Promise<ContextSnapshot> {
    const [value] = await records<ContextSnapshot>(db,
      "SELECT record FROM assistant.context_snapshots WHERE id=$1 AND owner_id=$2 AND tenant_id=$3",
      [id, principal.id, principal.tenantId]);
    if (value === undefined) throw notFound();
    return value;
  }

  async createSession(principal: VerifiedPrincipal, mode: SessionRecord["mode"], title?: string): Promise<SessionRecord> {
    const record: SessionRecord = { id: randomUUID(), ownerId: principal.id, tenantId: principal.tenantId,
      threadId: randomUUID(), title: title ?? "New conversation", mode, status: "active", createdAt: new Date().toISOString() };
    await transaction(this.pool, async (db) => {
      await db.query("INSERT INTO assistant.sessions(id,owner_id,tenant_id,record) VALUES($1,$2,$3,$4)",
        [record.id, principal.id, principal.tenantId, JSON.stringify(record)]);
      await audit(db, principal, "session.created", record.id);
    });
    return record;
  }

  listSessions(principal: VerifiedPrincipal): Promise<SessionRecord[]> {
    return records(this.pool,
      "SELECT record FROM assistant.sessions WHERE owner_id=$1 AND tenant_id=$2 AND record->>'status'<>'deleted' ORDER BY created_at,id",
      [principal.id, principal.tenantId]);
  }

  private async session(db: Db, id: string, principal: VerifiedPrincipal, lock = false): Promise<SessionRecord> {
    const [value] = await records<SessionRecord>(db,
      `SELECT record FROM assistant.sessions WHERE id=$1 AND owner_id=$2 AND tenant_id=$3${lock ? " FOR UPDATE" : ""}`,
      [id, principal.id, principal.tenantId]);
    if (value === undefined || value.status === "deleted") throw notFound();
    return value;
  }

  requireSession(id: string, principal: VerifiedPrincipal): Promise<SessionRecord> {
    return this.session(this.pool, id, principal);
  }

  async patchSession(id: string, principal: VerifiedPrincipal, patch: { title?: string; archived?: boolean }): Promise<SessionRecord> {
    return transaction(this.pool, async (db) => {
      const record = await this.session(db, id, principal, true);
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.archived !== undefined) record.status = patch.archived ? "archived" : "active";
      await db.query("UPDATE assistant.sessions SET record=$2,updated_at=now() WHERE id=$1", [id, JSON.stringify(record)]);
      await audit(db, principal, "session.updated", id);
      return record;
    });
  }

  async deleteSession(id: string, principal: VerifiedPrincipal): Promise<void> {
    await transaction(this.pool, async (db) => {
      const record = await this.session(db, id, principal, true);
      const active = await db.query("SELECT 1 FROM assistant.runs WHERE session_id=$1 AND status IN ('queued','running')", [id]);
      if (active.rowCount) throw new ServiceError("RUN_CONFLICT", "Cancel the active run before deleting the session.", 409);
      record.status = "deleted";
      await db.query("UPDATE assistant.sessions SET record=$2,updated_at=now() WHERE id=$1", [id, JSON.stringify(record)]);
      await audit(db, principal, "session.deleted", id);
    });
  }

  private async assertAvailable(db: Db, session: SessionRecord): Promise<void> {
    if (session.status !== "active") throw new ServiceError("SESSION_NOT_ACTIVE", "Session is not active.", 409);
    const active = await db.query("SELECT 1 FROM assistant.runs WHERE session_id=$1 AND status IN ('queued','running')", [session.id]);
    if (active.rowCount) throw new ServiceError("RUN_CONFLICT", "The session already has an active run.", 409);
  }

  private async insertRun(db: Db, run: RunRecord, requestKey: string): Promise<void> {
    await db.query("INSERT INTO assistant.runs(id,session_id,owner_id,tenant_id,request_key,status,record) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [run.id, run.sessionId, run.ownerId, run.tenantId, requestKey, run.status, JSON.stringify(run)]);
    await audit(db, { id: run.ownerId, tenantId: run.tenantId }, "run.created", run.id);
  }

  async createRun(input: Parameters<AgentStore["createRun"]>[0]) {
    return transaction(this.pool, async (db) => {
      const session = await this.session(db, input.sessionId, input.principal, true);
      const [existing] = await records<RunRecord>(db, "SELECT record FROM assistant.runs WHERE session_id=$1 AND request_key=$2",
        [session.id, `message:${input.clientRequestId}`]);
      if (existing !== undefined) return { run: existing, created: false };
      await this.snapshot(db, input.contextSnapshotId, input.principal);
      const pending = await db.query("SELECT 1 FROM assistant.interrupts WHERE session_id=$1 AND status='pending'", [session.id]);
      if (pending.rowCount) throw new ServiceError("INTERRUPT_RESUME_REQUIRED", "Resolve the pending interrupt before starting another run.", 409);
      await this.assertAvailable(db, session);
      const run: RunRecord = { id: randomUUID(), sessionId: session.id, ownerId: input.principal.id,
        tenantId: input.principal.tenantId, contextSnapshotId: input.contextSnapshotId,
        clientRequestId: input.clientRequestId, message: input.message, modelConfigVersion: this.modelConfigVersion,
        status: "queued", createdAt: new Date().toISOString() };
      await this.insertRun(db, run, `message:${input.clientRequestId}`);
      await this.writeMessage(db, { sessionId: session.id, runId: run.id, role: "user", content: run.message, evidenceRefs: [] });
      return { run, created: true };
    });
  }

  async requireRun(id: string, principal: VerifiedPrincipal): Promise<RunRecord> {
    return this.run(this.pool, id, principal);
  }

  private async run(db: Db, id: string, principal: VerifiedPrincipal): Promise<RunRecord> {
    const [run] = await records<RunRecord>(db,
      "SELECT r.record FROM assistant.runs r JOIN assistant.sessions s ON s.id=r.session_id WHERE r.id=$1 AND r.owner_id=$2 AND r.tenant_id=$3 AND s.record->>'status'<>'deleted'",
      [id, principal.id, principal.tenantId]);
    if (run === undefined) throw notFound();
    return run;
  }

  private async lockedRun(db: PoolClient, id: string): Promise<RunRecord> {
    const [run] = await records<RunRecord>(db, "SELECT record FROM assistant.runs WHERE id=$1 FOR UPDATE", [id]);
    if (run === undefined) throw notFound();
    return run;
  }

  private async updateStatus(db: Db, run: RunRecord, status: RunRecord["status"], errorCode?: string): Promise<void> {
    run.status = status;
    if (errorCode !== undefined) run.errorCode = errorCode;
    await db.query("UPDATE assistant.runs SET status=$2,record=$3,updated_at=now() WHERE id=$1", [run.id, status, JSON.stringify(run)]);
    await audit(db, { id: run.ownerId, tenantId: run.tenantId }, `run.${status}`, run.id, errorCode ?? "success");
  }

  async setRunStatus(id: string, status: RunRecord["status"], errorCode?: string): Promise<void> {
    await transaction(this.pool, async (db) => {
      const run = await this.lockedRun(db, id);
      if (TERMINAL.has(run.status) && run.status !== status) return;
      await this.updateStatus(db, run, status, errorCode);
    });
  }

  async finishRun(id: string, status: "interrupted" | "completed" | "failed" | "cancelled",
    data: Record<string, unknown>, errorCode?: string): Promise<void> {
    await transaction(this.pool, async (db) => {
      const run = await this.lockedRun(db, id);
      if (TERMINAL.has(run.status)) return;
      await this.updateStatus(db, run, status, errorCode);
      await this.writeEvent(db, run, `run.${status}`, data);
    });
  }

  async registerInterrupts(runId: string, interrupts: readonly AssistantInterrupt[]): Promise<void> {
    await transaction(this.pool, async (db) => {
      const run = await this.lockedRun(db, runId);
      for (const value of interrupts) {
        const record: PendingInterruptRecord = { ...value, runId, sessionId: run.sessionId, ownerId: run.ownerId,
          tenantId: run.tenantId, status: "pending", createdAt: new Date().toISOString() };
        await db.query("INSERT INTO assistant.interrupts(id,run_id,session_id,status,record) VALUES($1,$2,$3,$4,$5)",
          [value.id, runId, run.sessionId, record.status, JSON.stringify(record)]);
      }
    });
  }

  async requireInterrupt(runId: string, interruptId: string, principal: VerifiedPrincipal): Promise<PendingInterruptRecord> {
    await this.requireRun(runId, principal);
    const [value] = await records<PendingInterruptRecord>(this.pool,
      "SELECT record FROM assistant.interrupts WHERE run_id=$1 AND id=$2", [runId, interruptId]);
    if (value === undefined) throw notFound();
    return value;
  }

  async findPendingInterrupt(sessionId: string, interruptId: string, principal: VerifiedPrincipal): Promise<PendingInterruptRecord> {
    await this.requireSession(sessionId, principal);
    const [value] = await records<PendingInterruptRecord>(this.pool,
      "SELECT record FROM assistant.interrupts WHERE session_id=$1 AND id=$2 ORDER BY created_at DESC LIMIT 1", [sessionId, interruptId]);
    if (value === undefined) throw notFound();
    return value;
  }

  async createResumeRun(input: { principal: VerifiedPrincipal; interruptedRunId: string; response: ResumeRunRequest }) {
    return transaction(this.pool, async (db) => {
      const interruptedRun = await this.run(db, input.interruptedRunId, input.principal);
      const session = await this.session(db, interruptedRun.sessionId, input.principal, true);
      const key = `resume:${input.response.clientRequestId}`;
      const [existing] = await records<RunRecord>(db, "SELECT record FROM assistant.runs WHERE session_id=$1 AND request_key=$2", [session.id, key]);
      if (existing !== undefined) return { run: existing, interruptedRun, created: false };
      const [interrupt] = await records<PendingInterruptRecord>(db,
        "SELECT record FROM assistant.interrupts WHERE run_id=$1 AND id=$2 FOR UPDATE", [interruptedRun.id, input.response.interruptId]);
      if (interrupt === undefined) throw notFound();
      if (interrupt.status !== "pending") throw new ServiceError("INTERRUPT_ALREADY_RESOLVED", "Interrupt is no longer pending.", 409);
      if (interruptedRun.status !== "interrupted") throw new ServiceError("RUN_NOT_INTERRUPTED", "Run is not awaiting input.", 409);
      if (input.response.status === "resolved" && interrupt.expiresAt !== undefined && Date.parse(interrupt.expiresAt) <= Date.now())
        throw new ServiceError("INTERRUPT_EXPIRED", "Interrupt has expired.", 409);
      await this.assertAvailable(db, session);
      const run: RunRecord = { id: randomUUID(), sessionId: session.id, ownerId: input.principal.id, tenantId: input.principal.tenantId,
        contextSnapshotId: interruptedRun.contextSnapshotId, clientRequestId: input.response.clientRequestId,
        message: "", modelConfigVersion: interruptedRun.modelConfigVersion, status: "queued", resumedFromRunId: interruptedRun.id,
        interruptId: interrupt.id, createdAt: new Date().toISOString() };
      await this.insertRun(db, run, key);
      interrupt.status = input.response.status;
      interrupt.resolvedAt = new Date().toISOString();
      await db.query("UPDATE assistant.interrupts SET status=$3,record=$4,updated_at=now() WHERE run_id=$1 AND id=$2",
        [interruptedRun.id, interrupt.id, interrupt.status, JSON.stringify(interrupt)]);
      return { run, interruptedRun, created: true };
    });
  }

  private async writeMessage(db: Db, input: Omit<MessageRecord, "id" | "createdAt">): Promise<MessageRecord> {
    const record = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    await db.query("INSERT INTO assistant.messages(id,session_id,run_id,record) VALUES($1,$2,$3,$4)",
      [record.id, record.sessionId, record.runId, JSON.stringify(record)]);
    return record;
  }

  addMessage(input: Omit<MessageRecord, "id" | "createdAt">): Promise<MessageRecord> { return this.writeMessage(this.pool, input); }

  async listMessages(sessionId: string, principal: VerifiedPrincipal): Promise<MessageRecord[]> {
    await this.requireSession(sessionId, principal);
    const messages = await records<MessageRecord>(this.pool, "SELECT record FROM assistant.messages WHERE session_id=$1 ORDER BY created_at,id", [sessionId]);
    const events = await records<AssistantEvent>(this.pool,
      "SELECT e.record FROM assistant.events e JOIN assistant.runs r ON r.id=e.run_id WHERE r.session_id=$1 AND e.record->>'type'='view.created' ORDER BY e.created_at,e.sequence", [sessionId]);
    return messages.map((message) => message.role !== "assistant" ? message : { ...message,
      views: events.filter((event) => event.runId === message.runId).flatMap((event) => {
        const parsed = assistantViewSchema.safeParse(event.data);
        return parsed.success ? [parsed.data] : [];
      }) });
  }

  async listPendingInterrupts(sessionId: string, principal: VerifiedPrincipal): Promise<PendingInterruptRecord[]> {
    await this.requireSession(sessionId, principal);
    return records(this.pool, "SELECT record FROM assistant.interrupts WHERE session_id=$1 AND status='pending' ORDER BY created_at,id", [sessionId]);
  }

  private async writeEvent(db: Db, run: RunRecord, type: AssistantEventType, data: Record<string, unknown>): Promise<AssistantEvent> {
    const result = await db.query<{ sequence: number }>("SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM assistant.events WHERE run_id=$1", [run.id]);
    const sequence = result.rows[0]!.sequence;
    const event: AssistantEvent = { schemaVersion: "1", eventId: `${run.id}:${sequence}`, sequence,
      sessionId: run.sessionId, runId: run.id, timestamp: new Date().toISOString(), type, data };
    await db.query("INSERT INTO assistant.events(event_id,run_id,sequence,record) VALUES($1,$2,$3,$4)",
      [event.eventId, run.id, sequence, JSON.stringify(event)]);
    if (type.startsWith("tool.") || type.startsWith("approval."))
      await audit(db, { id: run.ownerId, tenantId: run.tenantId }, type, run.id,
        type === "tool.failed" ? "failure" : "success");
    return event;
  }

  appendEvent(runId: string, type: AssistantEventType, data: Record<string, unknown>): Promise<AssistantEvent> {
    return transaction(this.pool, async (db) => this.writeEvent(db, await this.lockedRun(db, runId), type, data));
  }

  async listEvents(runId: string, principal: VerifiedPrincipal, afterEventId?: string): Promise<AssistantEvent[]> {
    await this.requireRun(runId, principal);
    let sequence = 0;
    if (afterEventId !== undefined) {
      const found = await this.pool.query<{ sequence: number }>("SELECT sequence FROM assistant.events WHERE run_id=$1 AND event_id=$2", [runId, afterEventId]);
      if (found.rows[0] === undefined) throw new ServiceError("EVENT_CURSOR_EXPIRED", "Event cursor is unavailable.", 409);
      sequence = found.rows[0].sequence;
    }
    return records(this.pool, "SELECT record FROM assistant.events WHERE run_id=$1 AND sequence>$2 ORDER BY sequence", [runId, sequence]);
  }

  async *streamEvents(runId: string, principal: VerifiedPrincipal, afterEventId?: string): AsyncGenerator<AssistantEvent> {
    let cursor = afterEventId;
    while (true) {
      const events = await this.listEvents(runId, principal, cursor);
      for (const event of events) { cursor = event.eventId; yield event; }
      const run = await this.requireRun(runId, principal);
      if (TERMINAL.has(run.status)) {
        const terminal = await this.pool.query("SELECT 1 FROM assistant.events WHERE run_id=$1 AND record->>'type'=$2", [runId, `run.${run.status}`]);
        if (terminal.rowCount && (await this.listEvents(runId, principal, cursor)).length === 0) return;
      }
      await delay(200);
    }
  }

  async addEvidence(run: RunRecord, evidence: Evidence): Promise<void> {
    const record: EvidenceRecord = { referenceId: evidence.referenceId, ownerId: run.ownerId, tenantId: run.tenantId,
      runId: run.id, objectId: evidence.source.id, evidence, createdAt: new Date().toISOString() };
    // A reference must never be overwritten by another run or owner.
    await this.pool.query("INSERT INTO assistant.evidence(reference_id,run_id,owner_id,tenant_id,record) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reference_id) DO NOTHING",
      [record.referenceId, run.id, run.ownerId, run.tenantId, JSON.stringify(record)]);
    await this.requireEvidenceForRun(evidence.referenceId, run.id, {
      id: run.ownerId, tenantId: run.tenantId, displayName: "", authorizationRef: "", permissionScopes: [], authorizedObjectIds: [evidence.source.id],
    });
  }

  private async evidence(referenceId: string, principal: VerifiedPrincipal): Promise<EvidenceRecord> {
    const [record] = await records<EvidenceRecord>(this.pool,
      "SELECT e.record FROM assistant.evidence e JOIN assistant.runs r ON r.id=e.run_id JOIN assistant.sessions s ON s.id=r.session_id WHERE e.reference_id=$1 AND e.owner_id=$2 AND e.tenant_id=$3 AND s.record->>'status'<>'deleted'",
      [referenceId, principal.id, principal.tenantId]);
    if (record === undefined || (record.objectId !== undefined && !principal.authorizedObjectIds.includes(record.objectId))) throw notFound();
    return record;
  }

  async getEvidence(referenceId: string, principal: VerifiedPrincipal) {
    const record = await this.evidence(referenceId, principal);
    await audit(this.pool, principal, "evidence.resolved", referenceId);
    return resolveEvidence(record);
  }

  async requireEvidenceForRun(referenceId: string, runId: string, principal: VerifiedPrincipal): Promise<void> {
    const record = await this.evidence(referenceId, principal);
    if (record.runId !== runId) throw notFound();
  }
}
