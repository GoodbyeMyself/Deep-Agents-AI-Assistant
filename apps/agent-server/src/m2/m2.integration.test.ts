import { fileURLToPath } from "node:url";

import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { describe, expect, it } from "vitest";

import { FixedWindowRateLimiter, createApiHandler } from "./api.js";
import { createM2Application } from "./bootstrap.js";
import { ContextService, MockContextAuthorizer } from "./context-service.js";
import { AgentRunner, type StreamingAgent } from "./runner.js";
import { AgentService } from "./service.js";
import { InMemoryAgentStore } from "./store.js";
import { createNodeHttpServer } from "./node-http.js";

const installDir = fileURLToPath(new URL("../../../../adapters/demo-product-a/", import.meta.url));
const authA = { authorization: "Bearer mock-token-user-a", "content-type": "application/json" };
const authB = { authorization: "Bearer mock-token-user-b", "content-type": "application/json" };

function qualityModel() {
  return fakeModel()
    .respondWithTools([
      {
        name: "data_quality_get_trend",
        id: "quality-1",
        args: {
          tableId: "orders",
          startTime: "2026-10-14T00:00:00+08:00",
          endTime: "2026-10-14T23:59:59+08:00",
        },
      },
    ])
    .respond(new AIMessage("Observed quality score is 96 percent; see the supplied evidence."))
    .respondWithTools([
      {
        name: "data_quality_get_trend",
        id: "quality-2",
        args: {
          tableId: "orders",
          startTime: "2026-10-14T00:00:00+08:00",
          endTime: "2026-10-14T23:59:59+08:00",
        },
      },
    ])
    .respond(new AIMessage("The same verified scope remains available in this session."));
}

async function request(
  handler: (request: Request) => Promise<Response>,
  method: string,
  path: string,
  value?: unknown,
  headers: Record<string, string> = authA,
) {
  return handler(
    new Request(`http://assistant.local${path}`, {
      method,
      headers,
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    }),
  );
}

async function jsonValue(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("M2 trusted execution loop", () => {
  it("runs an authenticated quality query with context, evidence, SSE replay and thread continuity", async () => {
    const app = await createM2Application({
      model: qualityModel(),
      installDir,
      approvedPluginIds: new Set(["demo-product-a"]),
    });
    const snapshotResponse = await request(app.handler, "POST", "/api/v1/context/snapshots", {
      page: { type: "table-detail", route: "/tables/orders" },
      object: { type: "data_table", rawId: "orders", name: "Orders" },
      business: { domain: "data-quality" },
      user: { id: "attacker" },
      permissions: { scopes: ["admin"] },
    });
    expect(snapshotResponse.status).toBe(201);
    const snapshotId = String((await jsonValue(snapshotResponse))["id"]);
    const principal = await app.identity.authenticate(authA.authorization);
    const snapshot = app.store.requireSnapshot(snapshotId, principal);
    expect(snapshot.context.user.id).toBe("user-a");
    expect(snapshot.context.permissions.scopes).not.toContain("admin");

    const sessionResponse = await request(app.handler, "POST", "/api/v1/sessions", {
      mode: "assistant",
      title: "Quality review",
    });
    const session = await jsonValue(sessionResponse);
    const sessionId = String(session["id"]);
    const firstResponse = await request(app.handler, "POST", `/api/v1/sessions/${sessionId}/runs`, {
      message: "Analyze current table quality",
      contextSnapshotId: snapshotId,
      clientRequestId: "client-1",
    });
    expect(firstResponse.status).toBe(202);
    const firstRunId = String((await jsonValue(firstResponse))["runId"]);
    await app.runner.wait(firstRunId);
    expect(app.store.requireRun(firstRunId, principal).status).toBe("completed");

    const eventsResponse = await request(app.handler, "GET", `/api/v1/runs/${firstRunId}/events`);
    const eventText = await eventsResponse.text();
    for (const type of [
      "run.started",
      "tool.started",
      "tool.completed",
      "message.delta",
      "evidence.added",
      "view.created",
      "run.completed",
    ])
      expect(eventText).toContain(`event: ${type}`);
    const events = app.store.listEvents(firstRunId, principal);
    expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1));
    const cursor = events.find((event) => event.type === "tool.completed")!.eventId;
    const replay = await request(
      app.handler,
      "GET",
      `/api/v1/runs/${firstRunId}/events`,
      undefined,
      { ...authA, "last-event-id": cursor },
    );
    expect(await replay.text()).not.toContain(`id: ${cursor}\n`);

    const evidenceRef = String(
      events.find((event) => event.type === "evidence.added")!.data["referenceId"],
    );
    const evidenceResponse = await request(
      app.handler,
      "GET",
      `/api/v1/evidence/${encodeURIComponent(evidenceRef)}`,
    );
    const resolvedEvidence = await jsonValue(evidenceResponse);
    expect(resolvedEvidence["referenceId"]).toBe(evidenceRef);
    expect((resolvedEvidence["source"] as Record<string, unknown>)["id"]).toBe("orders");
    expect(
      (
        await request(
          app.handler,
          "GET",
          `/api/v1/evidence/${encodeURIComponent(evidenceRef)}`,
          undefined,
          authB,
        )
      ).status,
    ).toBe(404);

    const duplicate = await request(app.handler, "POST", `/api/v1/sessions/${sessionId}/runs`, {
      message: "must not create another run",
      contextSnapshotId: snapshotId,
      clientRequestId: "client-1",
    });
    expect(String((await jsonValue(duplicate))["runId"])).toBe(firstRunId);

    const second = await request(app.handler, "POST", `/api/v1/sessions/${sessionId}/runs`, {
      message: "Continue in the same conversation",
      contextSnapshotId: snapshotId,
      clientRequestId: "client-2",
    });
    const secondRunId = String((await jsonValue(second))["runId"]);
    await app.runner.wait(secondRunId);
    expect(app.store.listMessages(sessionId, principal)).toHaveLength(4);
    const state = (await Promise.resolve(
      app.agent.getState({ configurable: { thread_id: String(session["threadId"]) } }),
    )) as unknown as { values: unknown };
    expect(JSON.stringify(state.values)).toContain("Analyze current table quality");
    expect(JSON.stringify(state.values)).toContain("Continue in the same conversation");
    expect(app.store.auditRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          principalId: "user-a",
          capabilityId: "data_quality.get_trend",
          outcome: "success",
        }),
      ]),
    );
  });

  it("rejects unauthenticated, cross-owner, context tampering, field overreach and forged object access", async () => {
    const app = await createM2Application({
      model: qualityModel(),
      installDir,
      approvedPluginIds: new Set(["demo-product-a"]),
    });
    expect((await request(app.handler, "GET", "/api/v1/sessions", undefined, {})).status).toBe(401);
    expect(
      (
        await request(app.handler, "POST", "/api/v1/context/snapshots", {
          object: { type: "data_table", rawId: "customers" },
        })
      ).status,
    ).toBe(403);

    const session = await jsonValue(
      await request(app.handler, "POST", "/api/v1/sessions", { mode: "assistant" }),
    );
    expect(
      (
        await request(
          app.handler,
          "GET",
          `/api/v1/sessions/${String(session["id"])}`,
          undefined,
          authB,
        )
      ).status,
    ).toBe(404);
    expect((await request(app.handler, "GET", "/api/v1/plugins")).status).toBe(403);

    const denied = (await app.executor.execute(
      "data_quality.get_trend",
      "1.0.0",
      {
        tableId: "customers",
        startTime: "2026-10-14T00:00:00+08:00",
        endTime: "2026-10-14T23:59:59+08:00",
      },
      {
        executionContextId: "denied",
        contextSnapshotId: "snapshot",
        traceId: "trace",
        principalId: "user-a",
        authorizationRef: "mock-auth:user-a",
        contextObjectId: "orders",
        authorizedObjectIds: ["orders"],
        permissionScopes: ["data_quality:read"],
      },
    )) as { error?: { code: string } };
    expect(denied.error?.code).toBe("FORBIDDEN");

    const overreach = (await app.executor.execute(
      "data_quality.get_trend",
      "1.0.0",
      {
        tableId: "orders",
        startTime: "2026-10-14T00:00:00+08:00",
        endTime: "2026-10-14T23:59:59+08:00",
        internalFields: ["secret"],
      },
      {
        executionContextId: "invalid",
        contextSnapshotId: "snapshot",
        traceId: "trace",
        principalId: "user-a",
        authorizationRef: "mock-auth:user-a",
        authorizedObjectIds: ["orders"],
        permissionScopes: ["data_quality:read"],
      },
    )) as { error?: { code: string } };
    expect(overreach.error?.code).toBe("INVALID_INPUT");

    const provider = app.registry.resolve("data_quality.get_trend", "1.0.0")!.provider;
    const adapterDenied = (await provider.execute(
      {
        tableId: "customers",
        startTime: "2026-10-14T00:00:00+08:00",
        endTime: "2026-10-14T23:59:59+08:00",
      },
      {
        executionContextId: "adapter-denied",
        contextSnapshotId: "snapshot",
        traceId: "trace",
        principalId: "user-a",
        authorizationRef: "mock-auth:user-a",
        authorizedObjectIds: ["orders"],
        permissionScopes: ["data_quality:read"],
      },
    )) as { error?: { code: string } };
    expect(adapterDenied.error?.code).toBe("FORBIDDEN");
  });

  it("returns standard errors without stacks and enforces a user rate limit", async () => {
    const app = await createM2Application({
      model: qualityModel(),
      installDir,
      approvedPluginIds: new Set(["demo-product-a"]),
    });
    const handler = createApiHandler({
      identity: app.identity,
      service: app.service,
      rateLimiter: new FixedWindowRateLimiter(1),
    });
    expect((await request(handler, "GET", "/api/v1/sessions")).status).toBe(200);
    const limited = await request(handler, "GET", "/api/v1/sessions");
    expect(limited.status).toBe(429);
    const payload = await jsonValue(limited);
    expect(payload["code"]).toBe("RATE_LIMITED");
    expect(payload).not.toHaveProperty("stack");
  });

  it("keeps concurrent runs serialized and records cancellation and subagent lifecycle", async () => {
    const store = new InMemoryAgentStore();
    const identityApp = await createM2Application({
      model: qualityModel(),
      installDir,
      approvedPluginIds: new Set(["demo-product-a"]),
    });
    const principal = await identityApp.identity.authenticate(authA.authorization);
    const contextService = new ContextService(new MockContextAuthorizer());
    const snapshot = await contextService.create(
      { object: { type: "data_table", rawId: "orders" } },
      "assistant",
      principal,
    );
    store.saveSnapshot(snapshot);
    const session = store.createSession(principal, "assistant");
    const delayedAgent: StreamingAgent = {
      stream: (_input, config) =>
        Promise.resolve(
          (async function* () {
            await new Promise<void>((resolve) => setTimeout(resolve, 30));
            const namespace = ["tools:quality-worker"];
            yield [namespace, [new AIMessage("subagent output"), {}]];
            const signal = (config as { signal?: AbortSignal }).signal;
            if (signal?.aborted) return;
          })(),
        ),
    };
    const runner = new AgentRunner(delayedAgent, store);
    const service = new AgentService(store, contextService, runner);
    const run = service.createRun(
      session.id,
      { message: "slow", contextSnapshotId: snapshot.id, clientRequestId: "slow-1" },
      principal,
    );
    expect(() =>
      service.createRun(
        session.id,
        { message: "conflict", contextSnapshotId: snapshot.id, clientRequestId: "slow-2" },
        principal,
      ),
    ).toThrowError(/active run/i);
    runner.cancel(run.id, principal);
    await runner.wait(run.id);
    expect(store.requireRun(run.id, principal).status).toBe("cancelled");
    expect(store.listEvents(run.id, principal).map((event) => event.type)).toContain(
      "run.cancelled",
    );

    const subagentRun = service.createRun(
      session.id,
      { message: "subagent", contextSnapshotId: snapshot.id, clientRequestId: "slow-3" },
      principal,
    );
    await runner.wait(subagentRun.id);
    expect(store.listEvents(subagentRun.id, principal).map((event) => event.type)).toEqual(
      expect.arrayContaining(["subagent.started", "subagent.completed", "run.completed"]),
    );
  });

  it("serves the versioned contract through the real Node HTTP adapter", async () => {
    const app = await createM2Application({
      model: qualityModel(),
      installDir,
      approvedPluginIds: new Set(["demo-product-a"]),
    });
    const server = createNodeHttpServer(app.handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Expected a TCP address.");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/openapi.json`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(expect.objectContaining({ openapi: "3.1.0" }));
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });
});
