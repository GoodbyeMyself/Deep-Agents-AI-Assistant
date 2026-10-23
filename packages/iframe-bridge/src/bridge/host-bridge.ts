import { rawHostContextSchema, type RawHostContext } from "@assistant/context";
import type { HostNavigationAction } from "@assistant/contracts";

import { createBridgeEnvelope } from "../protocol/envelope.js";
import { parseTrustedBridgeEvent } from "../protocol/parse.js";
import type { BridgeMessage } from "../protocol/schema.js";

/**
 * 宿主侧桥接：在收到 `assistant.loaded` 或 iframe `load` 后发送 `host.hello`；
 * 用 `requestId` 去重，避免重复处理同一条 postMessage。
 */
export function createIframeHostBridge(options: {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  channelId: string;
  getTicket: () => string | Promise<string>;
  getContext: () => RawHostContext | Promise<RawHostContext>;
  onReady?: () => void;
  onHostAction?: (action: HostNavigationAction) => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  let started = false;
  let helloSent = false;
  const seenRequestIds = new Set<string>();
  const send = (message: BridgeMessage) =>
    options.iframe.contentWindow?.postMessage(message, options.targetOrigin);
  const hello = async () => {
    if (helloSent) return;
    helloSent = true;
    send({
      ...createBridgeEnvelope(options.channelId),
      type: "host.hello",
      payload: {
        ticket: await options.getTicket(),
        context: rawHostContextSchema.parse(await options.getContext()),
      },
    });
  };
  const requestHello = () => {
    void hello().catch(() => {
      helloSent = false;
      options.onError?.({ code: "BOOTSTRAP_FAILED", message: "Assistant bootstrap failed." });
    });
  };
  const listener = (event: MessageEvent) => {
    const message = parseTrustedBridgeEvent(event, {
      origin: options.targetOrigin,
      source: options.iframe.contentWindow,
      channelId: options.channelId,
    });
    if (message !== undefined && seenRequestIds.has(message.requestId)) return;
    if (message !== undefined) seenRequestIds.add(message.requestId);
    if (message?.type === "assistant.loaded") requestHello();
    if (message?.type === "assistant.ready") options.onReady?.();
    if (message?.type === "assistant.host-action") options.onHostAction?.(message.payload);
    if (message?.type === "assistant.error") options.onError?.(message.payload);
  };
  const loadListener = requestHello;
  return {
    start() {
      if (started) return;
      started = true;
      window.addEventListener("message", listener);
      options.iframe.addEventListener("load", loadListener, { once: true });
    },
    updateContext(context: RawHostContext) {
      send({
        ...createBridgeEnvelope(options.channelId),
        type: "host.context",
        payload: rawHostContextSchema.parse(context),
      });
    },
    open() {
      send({ ...createBridgeEnvelope(options.channelId), type: "host.open", payload: {} });
    },
    close() {
      send({ ...createBridgeEnvelope(options.channelId), type: "host.close", payload: {} });
    },
    destroy() {
      started = false;
      window.removeEventListener("message", listener);
      options.iframe.removeEventListener("load", loadListener);
    },
  };
}
