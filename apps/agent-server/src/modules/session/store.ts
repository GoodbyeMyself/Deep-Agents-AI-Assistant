import type {
  CapabilityAuditRecord,
  CapabilityAuditSink,
  Evidence,
} from "@assistant/capability-core";
import type { ContextSnapshot, VerifiedPrincipal } from "@assistant/context";
import type { AssistantEvent, AssistantEventType } from "@assistant/contracts";
import { resolveEvidence, type EvidenceRecord } from "@assistant/evidence";
import { randomUUID } from "node:crypto";

import { ServiceError, notFound } from "../../shared/errors.js";

export interface SessionRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly tenantId: string;
  readonly threadId: string;
  title: string;
  readonly mode: "assistant" | "standalone";
  status: "active" | "archived" | "deleted";
  readonly createdAt: string;
}
export interface RunRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly ownerId: string;
  readonly tenantId: string;
  readonly contextSnapshotId: string;
  readonly clientRequestId: string;
  readonly message: string;
  readonly modelConfigVersion: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  errorCode?: string;
  readonly createdAt: string;
}
export interface MessageRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly evidenceRefs: readonly string[];
  readonly createdAt: string;
}

export class InMemoryAgentStore implements CapabilityAuditSink {
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #runs = new Map<string, RunRecord>();
  readonly #messages: MessageRecord[] = [];
  readonly #snapshots = new Map<string, ContextSnapshot>();
  readonly #events = new Map<string, AssistantEvent[]>();
  readonly #eventListeners = new Map<string, Set<(event: AssistantEvent) => void>>();
  readonly #evidence = new Map<string, EvidenceRecord>();
  readonly #idempotency = new Map<string, string>();
  readonly #activeRuns = new Map<string, string>();
  readonly auditRecords: CapabilityAuditRecord[] = [];

  constructor(private readonly modelConfigVersion = "mock-model-config@1") {}

  write(record: CapabilityAuditRecord): Promise<void> {
    this.auditRecords.push(structuredClone(record));
    return Promise.resolve();
  }

  saveSnapshot(snapshot: ContextSnapshot): void {
    this.#snapshots.set(snapshot.id, structuredClone(snapshot));
  }

  requireSnapshot(id: string, principal: VerifiedPrincipal): ContextSnapshot {
    const value = this.#snapshots.get(id);
    if (
      value === undefined ||
      value.ownerId !== principal.id ||
      value.tenantId !== principal.tenantId
    )
      throw notFound();
    return structuredClone(value);
  }

  createSession(
    principal: VerifiedPrincipal,
    mode: SessionRecord["mode"],
    title?: string,
  ): SessionRecord {
    const id = randomUUID();
    const record: SessionRecord = {
      id,
      ownerId: principal.id,
      tenantId: principal.tenantId,
      threadId: randomUUID(),
      title: title ?? "New conversation",
      mode,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    this.#sessions.set(id, record);
    return structuredClone(record);
  }

  listSessions(principal: VerifiedPrincipal): SessionRecord[] {
    return [...this.#sessions.values()]
      .filter(
        (item) =>
          item.ownerId === principal.id &&
          item.tenantId === principal.tenantId &&
          item.status !== "deleted",
      )
      .map((item) => structuredClone(item));
  }

  requireSession(id: string, principal: VerifiedPrincipal): SessionRecord {
    const value = this.#sessions.get(id);
    if (
      value === undefined ||
      value.ownerId !== principal.id ||
      value.tenantId !== principal.tenantId ||
      value.status === "deleted"
    )
      throw notFound();
    return value;
  }

  patchSession(
    id: string,
    principal: VerifiedPrincipal,
    patch: { title?: string; archived?: boolean },
  ): SessionRecord {
    const session = this.requireSession(id, principal);
    if (patch.title !== undefined) session.title = patch.title;
    if (patch.archived !== undefined) session.status = patch.archived ? "archived" : "active";
    return structuredClone(session);
  }

  deleteSession(id: string, principal: VerifiedPrincipal): void {
    this.requireSession(id, principal).status = "deleted";
  }

  createRun(input: {
    principal: VerifiedPrincipal;
    sessionId: string;
    contextSnapshotId: string;
    clientRequestId: string;
    message: string;
  }): { run: RunRecord; created: boolean } {
    const session = this.requireSession(input.sessionId, input.principal);
    if (session.status !== "active")
      throw new ServiceError("SESSION_NOT_ACTIVE", "Session is not active.", 409);
    this.requireSnapshot(input.contextSnapshotId, input.principal);
    const key = `${session.id}:${input.clientRequestId}`;
    const existingId = this.#idempotency.get(key);
    if (existingId !== undefined)
      return { run: structuredClone(this.#runs.get(existingId)!), created: false };
    if (this.#activeRuns.has(session.id))
      throw new ServiceError("RUN_CONFLICT", "The session already has an active run.", 409);
    const run: RunRecord = {
      id: randomUUID(),
      sessionId: session.id,
      ownerId: input.principal.id,
      tenantId: input.principal.tenantId,
      contextSnapshotId: input.contextSnapshotId,
      clientRequestId: input.clientRequestId,
      message: input.message,
      modelConfigVersion: this.modelConfigVersion,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    this.#runs.set(run.id, run);
    this.#idempotency.set(key, run.id);
    this.#activeRuns.set(session.id, run.id);
    this.#messages.push({
      id: randomUUID(),
      sessionId: session.id,
      runId: run.id,
      role: "user",
      content: run.message,
      evidenceRefs: [],
      createdAt: new Date().toISOString(),
    });
    return { run: structuredClone(run), created: true };
  }

  requireRun(id: string, principal: VerifiedPrincipal): RunRecord {
    const value = this.#runs.get(id);
    if (
      value === undefined ||
      value.ownerId !== principal.id ||
      value.tenantId !== principal.tenantId
    )
      throw notFound();
    return value;
  }

  setRunStatus(id: string, status: RunRecord["status"], errorCode?: string): void {
    const run = this.#runs.get(id);
    if (run === undefined) throw notFound();
    run.status = status;
    if (errorCode !== undefined) run.errorCode = errorCode;
    if (["completed", "failed", "cancelled"].includes(status))
      this.#activeRuns.delete(run.sessionId);
  }

  addMessage(record: Omit<MessageRecord, "id" | "createdAt">): MessageRecord {
    const message = { ...record, id: randomUUID(), createdAt: new Date().toISOString() };
    this.#messages.push(message);
    return structuredClone(message);
  }

  listMessages(sessionId: string, principal: VerifiedPrincipal): MessageRecord[] {
    this.requireSession(sessionId, principal);
    return this.#messages
      .filter((item) => item.sessionId === sessionId)
      .map((item) => structuredClone(item));
  }

  appendEvent(
    runId: string,
    type: AssistantEventType,
    data: Record<string, unknown>,
  ): AssistantEvent {
    const run = this.#runs.get(runId);
    if (run === undefined) throw notFound();
    const events = this.#events.get(runId) ?? [];
    const sequence = events.length + 1;
    const event: AssistantEvent = {
      schemaVersion: "1",
      eventId: `${run.id}:${sequence}`,
      sequence,
      sessionId: run.sessionId,
      runId,
      timestamp: new Date().toISOString(),
      type,
      data,
    };
    events.push(event);
    this.#events.set(runId, events);
    for (const listener of this.#eventListeners.get(runId) ?? []) listener(structuredClone(event));
    return structuredClone(event);
  }

  listEvents(runId: string, principal: VerifiedPrincipal, afterEventId?: string): AssistantEvent[] {
    this.requireRun(runId, principal);
    const events = this.#events.get(runId) ?? [];
    if (afterEventId === undefined) return structuredClone(events);
    const index = events.findIndex((item) => item.eventId === afterEventId);
    if (index < 0)
      throw new ServiceError("EVENT_CURSOR_EXPIRED", "Event cursor is unavailable.", 409);
    return structuredClone(events.slice(index + 1));
  }

  async *streamEvents(
    runId: string,
    principal: VerifiedPrincipal,
    afterEventId?: string,
  ): AsyncGenerator<AssistantEvent> {
    this.requireRun(runId, principal);
    const queue: AssistantEvent[] = [];
    let wake: (() => void) | undefined;
    const listener = (event: AssistantEvent) => {
      queue.push(event);
      wake?.();
    };
    const listeners = this.#eventListeners.get(runId) ?? new Set<(event: AssistantEvent) => void>();
    listeners.add(listener);
    this.#eventListeners.set(runId, listeners);
    try {
      let lastSequence = 0;
      for (const event of this.listEvents(runId, principal, afterEventId)) {
        lastSequence = event.sequence;
        yield event;
      }
      if (afterEventId !== undefined && lastSequence === 0) {
        const all = this.listEvents(runId, principal);
        lastSequence = all.find((event) => event.eventId === afterEventId)?.sequence ?? 0;
      }
      while (true) {
        const run = this.requireRun(runId, principal);
        while (queue.length > 0) {
          const event = queue.shift()!;
          if (event.sequence <= lastSequence) continue;
          lastSequence = event.sequence;
          yield event;
        }
        if (["completed", "failed", "cancelled"].includes(run.status)) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = undefined;
      }
    } finally {
      listeners.delete(listener);
      if (listeners.size === 0) this.#eventListeners.delete(runId);
    }
  }

  addEvidence(run: RunRecord, evidence: Evidence): void {
    this.#evidence.set(evidence.referenceId, {
      referenceId: evidence.referenceId,
      ownerId: run.ownerId,
      tenantId: run.tenantId,
      runId: run.id,
      objectId: evidence.source.id,
      evidence: structuredClone(evidence),
      createdAt: new Date().toISOString(),
    });
  }

  getEvidence(referenceId: string, principal: VerifiedPrincipal) {
    const record = this.#evidence.get(referenceId);
    if (
      record === undefined ||
      record.ownerId !== principal.id ||
      record.tenantId !== principal.tenantId ||
      (record.objectId !== undefined && !principal.authorizedObjectIds.includes(record.objectId))
    )
      throw notFound();
    return resolveEvidence(record);
  }
}
