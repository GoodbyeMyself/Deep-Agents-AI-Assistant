import { describe, expect, it } from "vitest";

import { assistantEventSchema, createRunRequestSchema } from "./index.js";

describe("HTTP and SSE contracts", () => {
  it("validates a versioned monotonic event envelope", () => {
    expect(
      assistantEventSchema.parse({
        schemaVersion: "1",
        eventId: "run:1",
        sequence: 1,
        sessionId: "9906ac0c-9227-4109-bcc7-85760f17953b",
        runId: "a0a02e26-bb30-4b39-ae4e-5db731470a01",
        timestamp: "2026-10-14T00:00:00Z",
        type: "run.started",
        data: {},
      }).sequence,
    ).toBe(1);
  });

  it("rejects oversized or malformed run requests", () => {
    expect(
      createRunRequestSchema.safeParse({
        message: "",
        contextSnapshotId: "not-a-uuid",
        clientRequestId: "",
      }).success,
    ).toBe(false);
  });
});
