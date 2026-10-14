import { describe, expect, it, vi } from "vitest";

import { AssistantApiTransport } from "./index.js";

function event(sequence: number, type = "message.delta") {
  return {
    schemaVersion: "1",
    eventId: `run-1:${sequence}`,
    sequence,
    sessionId: "3cf147c3-3b30-4586-bdb3-b7f49b846ce4",
    runId: "d66e4139-053b-43d4-a104-fc0291fb5959",
    timestamp: "2026-10-14T08:00:00.000Z",
    type,
    data: type === "message.delta" ? { delta: "hello" } : {},
  };
}

function sse(...items: ReturnType<typeof event>[]): Response {
  const value = items
    .map((item) => `id: ${item.eventId}\ndata: ${JSON.stringify(item)}\n\n`)
    .join("");
  return new Response(value, { headers: { "content-type": "text/event-stream" } });
}

describe("AssistantApiTransport", () => {
  it("sends the credential and parses SSE without duplicate events", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(sse(event(1), event(1), event(2, "run.completed")));
    const transport = new AssistantApiTransport({
      getAccessCredential: () => "safe-token",
      fetchImpl,
    });
    const received = [];
    for await (const item of transport.watchRun("d66e4139-053b-43d4-a104-fc0291fb5959"))
      received.push(item);
    expect(received.map((item) => item.eventId)).toEqual(["run-1:1", "run-1:2"]);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer safe-token",
    });
  });

  it("queries run state after an interrupted stream and does not invent completion", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce(
        Response.json({
          id: "d66e4139-053b-43d4-a104-fc0291fb5959",
          sessionId: "3cf147c3-3b30-4586-bdb3-b7f49b846ce4",
          status: "completed",
        }),
      );
    const transport = new AssistantApiTransport({ getAccessCredential: () => "token", fetchImpl });
    const received = [];
    for await (const item of transport.watchRun("d66e4139-053b-43d4-a104-fc0291fb5959"))
      received.push(item);
    expect(received).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
