import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  traceId: z.string().uuid(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const createSessionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  mode: z.enum(["assistant", "standalone"]),
});

export const patchSessionRequestSchema = z
  .object({ title: z.string().trim().min(1).max(200).optional(), archived: z.boolean().optional() })
  .refine((value) => value.title !== undefined || value.archived !== undefined);

export const createRunRequestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  contextSnapshotId: z.string().uuid(),
  clientRequestId: z.string().trim().min(1).max(200),
});

export const assistantEventTypeSchema = z.enum([
  "run.started",
  "message.delta",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "evidence.added",
  "view.created",
  "subagent.started",
  "subagent.completed",
  "run.completed",
  "run.failed",
  "run.cancelled",
]);

export const assistantEventSchema = z.object({
  schemaVersion: z.literal("1"),
  eventId: z.string().min(1),
  sequence: z.number().int().positive(),
  sessionId: z.string().uuid(),
  runId: z.string().uuid(),
  timestamp: z.iso.datetime({ offset: true }),
  type: assistantEventTypeSchema,
  data: z.record(z.string(), z.unknown()),
});

const viewBaseSchema = z.object({
  viewId: z.string().uuid(),
  schemaVersion: z.literal("1"),
  title: z.string().min(1).optional(),
  evidenceIds: z.array(z.string()),
});

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const assistantViewSchema = z.discriminatedUnion("viewType", [
  viewBaseSchema.extend({
    viewType: z.literal("text"),
    data: z.object({ content: z.string() }),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("metric"),
    data: z.object({
      label: z.string(),
      value: scalarSchema,
      unit: z.string().optional(),
      trend: z.enum(["up", "down", "flat"]).optional(),
    }),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("table"),
    data: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string(), scalarSchema)),
    }),
  }),
  z.object({
    viewId: z.string().uuid(),
    viewType: z.literal("chart.line"),
    schemaVersion: z.literal("1"),
    title: z.string().min(1),
    data: z.object({
      xField: z.literal("time"),
      yField: z.literal("value"),
      rows: z.array(z.object({ time: z.string(), value: z.number() })),
    }),
    evidenceIds: z.array(z.string()),
  }),
  viewBaseSchema.extend({
    viewType: z.literal("references"),
    data: z.object({
      items: z.array(z.object({ referenceId: z.string(), title: z.string().optional() })),
    }),
  }),
]);

export type AssistantEvent = z.infer<typeof assistantEventSchema>;
export type AssistantEventType = z.infer<typeof assistantEventTypeSchema>;
export type AssistantView = z.infer<typeof assistantViewSchema>;

export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Enterprise AI Assistant API", version: "1.0.0-m3" },
  paths: {
    "/api/v1/context/snapshots": { post: { summary: "Create an authorized context snapshot" } },
    "/api/v1/sessions": {
      get: { summary: "List owned sessions" },
      post: { summary: "Create session" },
    },
    "/api/v1/sessions/{id}": { get: {}, patch: {}, delete: {} },
    "/api/v1/sessions/{id}/messages": { get: {} },
    "/api/v1/sessions/{id}/runs": { post: { summary: "Create an idempotent run" } },
    "/api/v1/runs/{id}": { get: {} },
    "/api/v1/runs/{id}/events": { get: { summary: "Read or replay SSE events" } },
    "/api/v1/runs/{id}/cancel": { post: {} },
    "/api/v1/evidence/{referenceId}": { get: { summary: "Resolve evidence after authorization" } },
    "/api/v1/models": { get: { summary: "List safe model metadata for this deployment" } },
    "/api/v1/plugins": { get: { summary: "List installed plugin status" } },
    "/api/v1/capabilities": { get: { summary: "List registered standard capabilities" } },
  },
} as const;
