import { rawHostContextSchema, type RawHostContext } from "@assistant/context";
import { z } from "zod";

export const BRIDGE_PROTOCOL = "enterprise-assistant-bridge";
export const BRIDGE_VERSION = 1;

const envelopeSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  version: z.literal(BRIDGE_VERSION),
  channelId: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const bridgeMessageSchema = z.discriminatedUnion("type", [
  envelopeSchema.extend({
    type: z.literal("host.hello"),
    payload: z.object({ ticket: z.string().min(20).max(512), context: rawHostContextSchema }),
  }),
  envelopeSchema.extend({ type: z.literal("host.context"), payload: rawHostContextSchema }),
  envelopeSchema.extend({ type: z.literal("host.open"), payload: z.object({}) }),
  envelopeSchema.extend({ type: z.literal("host.close"), payload: z.object({}) }),
  envelopeSchema.extend({ type: z.literal("assistant.ready"), payload: z.object({}) }),
  envelopeSchema.extend({
    type: z.literal("assistant.error"),
    payload: z.object({ code: z.string().max(80), message: z.string().max(500) }),
  }),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;

function envelope(channelId: string) {
  return {
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    channelId,
    requestId: crypto.randomUUID(),
  } as const;
}

export function parseTrustedBridgeEvent(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  expected: { origin: string; source: MessageEventSource | null; channelId: string },
): BridgeMessage | undefined {
  if (event.origin !== expected.origin || event.source !== expected.source) return undefined;
  const result = bridgeMessageSchema.safeParse(event.data);
  if (!result.success || result.data.channelId !== expected.channelId) return undefined;
  return result.data;
}

export function createIframeHostBridge(options: {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  channelId: string;
  getTicket: () => string | Promise<string>;
  getContext: () => RawHostContext | Promise<RawHostContext>;
  onReady?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  let started = false;
  const seenRequestIds = new Set<string>();
  const send = (message: BridgeMessage) =>
    options.iframe.contentWindow?.postMessage(message, options.targetOrigin);
  const hello = async () => {
    send({
      ...envelope(options.channelId),
      type: "host.hello",
      payload: {
        ticket: await options.getTicket(),
        context: rawHostContextSchema.parse(await options.getContext()),
      },
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
    if (message?.type === "assistant.ready") options.onReady?.();
    if (message?.type === "assistant.error") options.onError?.(message.payload);
  };
  const loadListener = () => void hello();
  return {
    start() {
      if (started) return;
      started = true;
      window.addEventListener("message", listener);
      options.iframe.addEventListener("load", loadListener, { once: true });
    },
    updateContext(context: RawHostContext) {
      send({
        ...envelope(options.channelId),
        type: "host.context",
        payload: rawHostContextSchema.parse(context),
      });
    },
    open() {
      send({ ...envelope(options.channelId), type: "host.open", payload: {} });
    },
    close() {
      send({ ...envelope(options.channelId), type: "host.close", payload: {} });
    },
    destroy() {
      started = false;
      window.removeEventListener("message", listener);
      options.iframe.removeEventListener("load", loadListener);
    },
  };
}

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
        .then(() => send({ ...envelope(options.channelId), type: "assistant.ready", payload: {} }))
        .catch((error: unknown) => {
          options.onError?.(error);
          send({
            ...envelope(options.channelId),
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
    },
    destroy() {
      window.removeEventListener("message", listener);
    },
  };
}
