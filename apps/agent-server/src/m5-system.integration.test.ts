import { fileURLToPath } from "node:url";

import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { describe, expect, it } from "vitest";

import { createM2Application } from "./m2/bootstrap.js";
import { createNodeHttpServer } from "./m2/node-http.js";

const auth = { authorization: "Bearer mock-token-user-a", "content-type": "application/json" };

function installDirectory(pluginId: "demo-product-a" | "demo-product-b"): string {
  return fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
}

async function createDeployment(pluginId: "demo-product-a" | "demo-product-b") {
  return createM2Application({
    model: fakeModel().respond(new AIMessage("unused")),
    installDir: installDirectory(pluginId),
    approvedPluginIds: new Set([pluginId]),
    modelConfig: {
      id: "default",
      provider: "offline-test",
      model: `model-for-${pluginId}`,
      version: "1",
    },
  });
}

async function request(
  handler: (request: Request) => Promise<Response>,
  method: string,
  path: string,
  body?: unknown,
) {
  return handler(
    new Request(`http://assistant.local${path}`, {
      method,
      headers: auth,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

const executionContext = {
  executionContextId: "m5-execution",
  contextSnapshotId: "m5-snapshot",
  traceId: "m5-trace",
  principalId: "user-a",
  tenantId: "tenant-1",
  authorizationRef: "mock-auth:user-a",
  contextObjectId: "orders",
  authorizedObjectIds: ["orders"],
  permissionScopes: ["data_map:read", "data_quality:read"],
};

const trendInput = {
  tableId: "orders",
  startTime: "2026-10-13T00:00:00+08:00",
  endTime: "2026-10-14T23:59:59+08:00",
};

describe("M5 independent deployment system acceptance", () => {
  it("boots A and B from the same server composition with isolated runtime state", async () => {
    const [productA, productB] = await Promise.all([
      createDeployment("demo-product-a"),
      createDeployment("demo-product-b"),
    ]);

    expect(productA.pluginRecords).toEqual([
      expect.objectContaining({ pluginId: "demo-product-a", status: "ready" }),
    ]);
    expect(productB.pluginRecords).toEqual([
      expect.objectContaining({ pluginId: "demo-product-b", status: "ready" }),
    ]);
    expect(
      productA.registry
        .list()
        .map((item) => item.capabilityId)
        .sort(),
    ).toEqual(
      productB.registry
        .list()
        .map((item) => item.capabilityId)
        .sort(),
    );
    expect(productA.store).not.toBe(productB.store);
    expect(productA.checkpointer).not.toBe(productB.checkpointer);

    const serverA = createNodeHttpServer(productA.handler);
    const serverB = createNodeHttpServer(productB.handler);
    await Promise.all(
      [serverA, serverB].map(
        (server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)),
      ),
    );
    try {
      const ports = [serverA, serverB].map((server) => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          throw new Error("Expected each M5 instance to have a TCP address.");
        }
        return address.port;
      });
      const responses = await Promise.all(
        ports.map((port) =>
          fetch(`http://127.0.0.1:${port}/api/v1/capabilities`, { headers: auth }),
        ),
      );
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      const payloads = await Promise.all(
        responses.map((response) => response.json() as Promise<{ items: unknown[] }>),
      );
      expect(payloads.map((payload) => payload.items.length)).toEqual([2, 2]);
    } finally {
      await Promise.all(
        [serverA, serverB].map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error === undefined ? resolve() : reject(error))),
            ),
        ),
      );
    }

    const sessionResponse = await request(productA.handler, "POST", "/api/v1/sessions", {
      mode: "assistant",
      title: "Product A only",
    });
    const session = (await sessionResponse.json()) as { id: string };
    expect((await request(productA.handler, "GET", `/api/v1/sessions/${session.id}`)).status).toBe(
      200,
    );
    expect((await request(productB.handler, "GET", `/api/v1/sessions/${session.id}`)).status).toBe(
      404,
    );
  });

  it("normalizes different A/B APIs to equivalent standard capability semantics", async () => {
    const [productA, productB] = await Promise.all([
      createDeployment("demo-product-a"),
      createDeployment("demo-product-b"),
    ]);

    const [trendA, trendB, objectsA, objectsB] = await Promise.all([
      productA.executor.execute("data_quality.get_trend", "1.0.0", trendInput, executionContext),
      productB.executor.execute("data_quality.get_trend", "1.0.0", trendInput, executionContext),
      productA.executor.execute(
        "data_map.search_objects",
        "1.0.0",
        { keyword: "orders" },
        executionContext,
      ),
      productB.executor.execute(
        "data_map.search_objects",
        "1.0.0",
        { keyword: "orders" },
        executionContext,
      ),
    ]);

    for (const result of [trendA, trendB]) {
      const value = result as {
        status: string;
        warnings: Array<{ code: string }>;
        data: Record<string, unknown>;
        evidence: Array<{
          source: { type: string; id: string };
          dataScope: { from: string; to: string };
          methodology: string;
          referenceId: string;
        }>;
      };
      expect(value.status).toBe("partial");
      expect(value.warnings.map((warning) => warning.code)).toEqual(["MISSING_DATES"]);
      expect(value.data).toMatchObject({
        tableId: "orders",
        unit: "percent",
        aggregation: "daily",
        points: [{ time: "2026-10-14", value: 96 }],
        missingDates: ["2026-10-13"],
      });
      expect(value.evidence).toHaveLength(1);
      expect(value.evidence[0]?.source).toEqual({ type: "table", id: "orders" });
      expect(value.evidence[0]?.dataScope).toEqual({
        from: trendInput.startTime,
        to: trendInput.endTime,
      });
      expect(value.evidence[0]?.methodology.length).toBeGreaterThan(0);
      expect(value.evidence[0]?.referenceId.length).toBeGreaterThan(0);
    }
    for (const result of [objectsA, objectsB]) {
      const value = result as {
        status: string;
        data: { objects: Array<{ type: string; id: string; name: string }> };
      };
      expect(value.status).toBe("success");
      expect(value.data.objects[0]).toMatchObject({
        type: "data_table",
        id: "orders",
        name: "Orders",
      });
    }
  });

  it("enforces object denial in both products and keeps each ContextSnapshot immutable", async () => {
    const [productA, productB] = await Promise.all([
      createDeployment("demo-product-a"),
      createDeployment("demo-product-b"),
    ]);
    for (const deployment of [productA, productB]) {
      const denied = (await deployment.executor.execute(
        "data_quality.get_trend",
        "1.0.0",
        { ...trendInput, tableId: "customers" },
        executionContext,
      )) as { error?: { code: string } };
      expect(denied.error?.code).toBe("FORBIDDEN");
    }

    const firstResponse = await request(productA.handler, "POST", "/api/v1/context/snapshots", {
      page: { type: "table-detail", route: "/tables/orders" },
      object: { type: "data_table", rawId: "orders", name: "Orders" },
    });
    const secondResponse = await request(productA.handler, "POST", "/api/v1/context/snapshots", {
      page: { type: "table-detail", route: "/tables/customers" },
      object: { type: "data_table", rawId: "customers", name: "Customers" },
    });
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(403);
    const first = (await firstResponse.json()) as { id: string };
    const principal = await productA.identity.authenticate(auth.authorization);
    expect(productA.store.requireSnapshot(first.id, principal).context.object?.id).toBe("orders");
  });

  it("documents the current restart boundary by proving in-memory sessions are not recovered", async () => {
    const beforeRestart = await createDeployment("demo-product-a");
    const response = await request(beforeRestart.handler, "POST", "/api/v1/sessions", {
      mode: "assistant",
    });
    const session = (await response.json()) as { id: string };
    const afterRestart = await createDeployment("demo-product-a");

    expect(
      (await request(afterRestart.handler, "GET", `/api/v1/sessions/${session.id}`)).status,
    ).toBe(404);
  });
});
