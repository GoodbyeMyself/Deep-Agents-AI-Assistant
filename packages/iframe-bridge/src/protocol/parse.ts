import type { BridgeMessage } from "./schema.js";
import { bridgeMessageSchema } from "./schema.js";

/**
 * 在 `message` 监听器内解析可信桥接消息；不匹配则返回 `undefined`（静默丢弃）。
 */
export function parseTrustedBridgeEvent(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  expected: { origin: string; source: MessageEventSource | null; channelId: string },
): BridgeMessage | undefined {
  if (event.origin !== expected.origin || event.source !== expected.source) return undefined;
  const result = bridgeMessageSchema.safeParse(event.data);
  if (!result.success || result.data.channelId !== expected.channelId) return undefined;
  return result.data;
}
