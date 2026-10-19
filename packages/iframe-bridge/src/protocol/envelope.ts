import { BRIDGE_PROTOCOL, BRIDGE_VERSION } from "./constants.js";

/** 构造带新 `requestId` 的协议信封字段（不含 `type` / `payload`）。 */
export function createBridgeEnvelope(channelId: string) {
  return {
    protocol: BRIDGE_PROTOCOL,
    version: BRIDGE_VERSION,
    channelId,
    requestId: crypto.randomUUID(),
  } as const;
}
