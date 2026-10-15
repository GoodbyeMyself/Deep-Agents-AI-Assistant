// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  BRIDGE_PROTOCOL,
  BRIDGE_VERSION,
  createIframeAssistantBridge,
  parseTrustedBridgeEvent,
} from "./index.js";

const source = {} as MessageEventSource;
const valid = {
  protocol: BRIDGE_PROTOCOL,
  version: BRIDGE_VERSION,
  channelId: "70853142-26a5-47cd-a5ff-7287c8a09b8a",
  requestId: "89853142-26a5-47cd-a5ff-7287c8a09b8a",
  type: "host.context",
  payload: { page: { route: "/orders" } },
};

describe("iframe bridge validation", () => {
  it("accepts only the configured origin, source, channel and schema", () => {
    const expected = { origin: "https://host.example", source, channelId: valid.channelId };
    expect(
      parseTrustedBridgeEvent({ origin: expected.origin, source, data: valid }, expected)?.type,
    ).toBe("host.context");
    expect(
      parseTrustedBridgeEvent({ origin: "https://evil.example", source, data: valid }, expected),
    ).toBeUndefined();
    expect(
      parseTrustedBridgeEvent({ origin: expected.origin, source: null, data: valid }, expected),
    ).toBeUndefined();
    expect(
      parseTrustedBridgeEvent(
        { origin: expected.origin, source, data: { ...valid, channelId: crypto.randomUUID() } },
        expected,
      ),
    ).toBeUndefined();
    expect(
      parseTrustedBridgeEvent(
        { origin: expected.origin, source, data: { ...valid, version: 2 } },
        expected,
      ),
    ).toBeUndefined();
  });

  it("rejects malformed or secret-bearing context fields", () => {
    const expected = { origin: "https://host.example", source, channelId: valid.channelId };
    const result = parseTrustedBridgeEvent(
      { origin: expected.origin, source, data: { ...valid, payload: { token: "must-not-pass" } } },
      expected,
    );
    expect(result?.type).toBe("host.context");
    expect(result?.payload).toEqual({});
  });

  it("ignores a replayed request ID", () => {
    const onContext = vi.fn();
    const hostWindow = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createIframeAssistantBridge({
      hostWindow,
      hostOrigin: "https://host.example",
      channelId: valid.channelId,
      onHello: vi.fn(),
      onContext,
    });
    bridge.start();
    const event = new MessageEvent("message", {
      origin: "https://host.example",
      source: hostWindow,
      data: valid,
    });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
    bridge.destroy();
    expect(onContext).toHaveBeenCalledOnce();
  });
});
