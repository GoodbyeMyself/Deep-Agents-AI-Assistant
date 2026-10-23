/**
 * 宿主页面与跨 Origin iframe 助手之间的版本化 `postMessage` 协议与挂载能力。
 */
export { createIframeAssistantBridge } from "./bridge/assistant-bridge.js";
export { createIframeHostBridge } from "./bridge/host-bridge.js";
export { ASSISTANT_CONTEXT_EVENT, ASSISTANT_HOST_ACTION_EVENT } from "./host/constants.js";
export { mountIframeAssistant } from "./host/mount-iframe-assistant.js";
export type { IframeAssistantHost, IframeAssistantHostOptions } from "./host/types.js";
export { BRIDGE_PROTOCOL, BRIDGE_VERSION } from "./protocol/constants.js";
export { parseTrustedBridgeEvent } from "./protocol/parse.js";
export { bridgeMessageSchema, type BridgeMessage } from "./protocol/schema.js";
