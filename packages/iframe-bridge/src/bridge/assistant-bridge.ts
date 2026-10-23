import type { RawHostContext } from "@assistant/context";
import { hostNavigationActionSchema, type HostNavigationAction } from "@assistant/contracts";

import { createBridgeEnvelope } from "../protocol/envelope.js";
import { parseTrustedBridgeEvent } from "../protocol/parse.js";
import type { BridgeMessage } from "../protocol/schema.js";

/**
 * iframe 内助手侧桥接：启动时主动 `assistant.loaded`，完成 `host.hello` 后回复 `assistant.ready`。
 */
export function createIframeAssistantBridge(options: {
  hostWindow: Window;
  hostOrigin: string;
  channelId: string;
  onHello: (ticket: string, context: RawHostContext) => void | Promise<void>;
  onContext: (context: RawHostContext) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
}) {
  const seenRequestIds = new Set<string>();
  const send = (message: BridgeMessage) =>
    options.hostWindow.postMessage(message, options.hostOrigin);
  const listener = (event: MessageEvent) => {
    const message = parseTrustedBridgeEvent(event, {
      origin: options.hostOrigin,
      source: options.hostWindow,
      channelId: options.channelId,
    });
    if (message === undefined) return;
    if (seenRequestIds.has(message.requestId)) return;
    seenRequestIds.add(message.requestId);
    if (message.type === "host.hello") {
      void Promise.resolve(options.onHello(message.payload.ticket, message.payload.context))
        .then(() =>
          send({
            ...createBridgeEnvelope(options.channelId),
            type: "assistant.ready",
            payload: {},
          }),
        )
        .catch((error: unknown) => {
          options.onError?.(error);
          send({
            ...createBridgeEnvelope(options.channelId),
            type: "assistant.error",
            payload: { code: "BOOTSTRAP_FAILED", message: "Assistant bootstrap failed." },
          });
        });
    }
    if (message.type === "host.context") options.onContext(message.payload);
    if (message.type === "host.open") options.onOpen?.();
    if (message.type === "host.close") options.onClose?.();
  };
  return {
    start() {
      window.addEventListener("message", listener);
      send({ ...createBridgeEnvelope(options.channelId), type: "assistant.loaded", payload: {} });
    },
    requestHostAction(action: HostNavigationAction) {
      send({
        ...createBridgeEnvelope(options.channelId),
        type: "assistant.host-action",
        payload: hostNavigationActionSchema.parse(action),
      });
    },
    requestBootstrap() {
      send({
        ...createBridgeEnvelope(options.channelId),
        type: "assistant.bootstrap-required",
        payload: {},
      });
    },
    destroy() {
      window.removeEventListener("message", listener);
    },
  };
}
