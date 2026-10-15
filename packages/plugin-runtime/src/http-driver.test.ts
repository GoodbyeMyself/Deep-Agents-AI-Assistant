import { describe, expect, it, vi } from "vitest";

import { HttpCapabilityDriver } from "./http-driver.js";

const context = {
  executionContextId: "execution-1",
  contextSnapshotId: "snapshot-1",
  traceId: "trace-1",
  principalId: "user-1",
  permissionScopes: ["data_quality:read"],
};

describe("HTTP capability driver", () => {
  it("uses an approved origin, bounded protocol, and trusted context fields", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: "error",
            data: null,
            evidence: [],
            warnings: [],
            error: { code: "UNSUPPORTED", message: "fixture", retryable: false },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const driver = new HttpCapabilityDriver({
      baseUrl: "https://business.example.test/adapter/",
      allowedOrigins: new Set(["https://business.example.test"]),
      fetchImplementation,
    });

    await driver.invoke("data_quality.get_trend", "1.0.0", { tableId: "orders" }, context);

    const request = fetchImplementation.mock.calls[0];
    const requestUrl = request?.[0];
    expect(requestUrl instanceof URL ? requestUrl.href : requestUrl).toBe(
      "https://business.example.test/adapter/capabilities/data_quality.get_trend/invoke",
    );
    const init = request?.[1];
    expect(init?.redirect).toBe("manual");
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body.");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        contractVersion: "1.0.0",
        traceId: "trace-1",
        contextSnapshotId: "snapshot-1",
      }),
    );
    expect(body).not.toHaveProperty("principalId");
    expect(body).not.toHaveProperty("permissionScopes");
  });

  it("rejects unapproved origins and non-loopback plaintext HTTP", () => {
    expect(
      () =>
        new HttpCapabilityDriver({
          baseUrl: "https://unapproved.example.test/",
          allowedOrigins: new Set(["https://approved.example.test"]),
        }),
    ).toThrow("not approved");
    expect(
      () =>
        new HttpCapabilityDriver({
          baseUrl: "http://business.example.test/",
          allowedOrigins: new Set(["http://business.example.test"]),
        }),
    ).toThrow("loopback");
  });

  it("aborts a provider request that exceeds the configured timeout", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("Provider timed out.")), {
            once: true,
          });
        }),
    );
    const driver = new HttpCapabilityDriver({
      baseUrl: "https://business.example.test/adapter/",
      allowedOrigins: new Set(["https://business.example.test"]),
      timeoutMs: 5,
      fetchImplementation,
    });

    await expect(
      driver.invoke("data_quality.get_trend", "1.0.0", { tableId: "orders" }, context),
    ).rejects.toBeDefined();
  });
});
