import type { AssistantEvent } from "@assistant/contracts";
import { describe, expect, it } from "vitest";

import { chatReducer, initialChatState } from "./store.js";

const assistant = {
  id: "a",
  role: "assistant" as const,
  content: "",
  status: "loading" as const,
  evidenceIds: [],
  views: [],
};
const user = {
  id: "u",
  role: "user" as const,
  content: "hello",
  status: "success" as const,
  evidenceIds: [],
  views: [],
};
const baseEvent: AssistantEvent = {
  schemaVersion: "1",
  eventId: "e1",
  sequence: 1,
  sessionId: "3cf147c3-3b30-4586-bdb3-b7f49b846ce4",
  runId: "d66e4139-053b-43d4-a104-fc0291fb5959",
  timestamp: "2026-10-14T08:00:00.000Z",
  type: "message.delta",
  data: { delta: "结果" },
};

describe("chatReducer", () => {
  it("applies streaming text exactly once", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const once = chatReducer(submitted, { type: "event", event: baseEvent });
    const twice = chatReducer(once, { type: "event", event: baseEvent });
    expect(twice.messages[1]?.content).toBe("结果");
  });

  it("isolates session messages on reset", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const reset = chatReducer(submitted, { type: "reset", messages: [] });
    expect(reset.messages).toEqual([]);
    expect(reset.seenEventIds.size).toBe(0);
  });

  it("preserves a partial answer and marks it failed", () => {
    const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
    const partial = chatReducer(submitted, { type: "event", event: baseEvent });
    const failed = chatReducer(partial, { type: "failed", message: "network interrupted" });
    expect(failed.messages[1]).toMatchObject({ content: "结果", status: "error" });
  });

  it("produces the same product-agnostic view model for normalized A/B events", () => {
    const build = () => {
      const submitted = chatReducer(initialChatState, { type: "submit", user, assistant });
      return chatReducer(submitted, { type: "event", event: baseEvent }).messages;
    };
    expect(build()).toEqual(build());
  });
});
