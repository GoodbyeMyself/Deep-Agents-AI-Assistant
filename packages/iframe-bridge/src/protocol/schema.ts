import { rawHostContextSchema } from "@assistant/context";
import { hostNavigationActionSchema } from "@assistant/contracts";
import { z } from "zod";

import { BRIDGE_PROTOCOL, BRIDGE_VERSION } from "./constants.js";

/** 所有桥接消息的公共信封字段。 */
const envelopeSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  version: z.literal(BRIDGE_VERSION),
  channelId: z.string().uuid(),
  requestId: z.string().uuid(),
});

/**
 * Host ↔ iframe 双向消息；`type` 为判别字段。
 * `host.hello` 携带一次性 embed ticket 与初始 RawHostContext（须经 Schema，不构成授权）。
 */
export const bridgeMessageSchema = z.discriminatedUnion("type", [
  envelopeSchema.extend({
    type: z.literal("host.hello"),
    payload: z.object({ ticket: z.string().min(20).max(512), context: rawHostContextSchema }),
  }),
  envelopeSchema.extend({ type: z.literal("host.context"), payload: rawHostContextSchema }),
  envelopeSchema.extend({ type: z.literal("host.open"), payload: z.object({}) }),
  envelopeSchema.extend({ type: z.literal("host.close"), payload: z.object({}) }),
  envelopeSchema.extend({ type: z.literal("assistant.loaded"), payload: z.object({}) }),
  envelopeSchema.extend({
    type: z.literal("assistant.bootstrap-required"),
    payload: z.object({}),
  }),
  envelopeSchema.extend({ type: z.literal("assistant.ready"), payload: z.object({}) }),
  envelopeSchema.extend({
    type: z.literal("assistant.host-action"),
    payload: hostNavigationActionSchema,
  }),
  envelopeSchema.extend({
    type: z.literal("assistant.error"),
    payload: z.object({ code: z.string().max(80), message: z.string().max(500) }),
  }),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;
