/**
 * 前后端共享的 Assistant API 请求、SSE 事件与受控 View 的 Zod 契约。
 * 仅描述传输层协议；业务 Capability 输入/输出见 `core/capability`。
 */
import { z } from "zod";

export { assistantViewSchema, type AssistantView } from "./views.js";

// --- HTTP API：统一错误与写操作请求体 ---

/** Agent Server 标准错误响应（与 HTTP 状态码配套）。 */
export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  traceId: z.string().uuid(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** `POST /api/v1/sessions` */
export const createSessionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  mode: z.enum(["assistant", "standalone"]),
});

/** `PATCH /api/v1/sessions/{id}`；至少提供 title 或 archived 之一。 */
export const patchSessionRequestSchema = z
  .object({ title: z.string().trim().min(1).max(200).optional(), archived: z.boolean().optional() })
  .refine((value) => value.title !== undefined || value.archived !== undefined);

/**
 * `POST /api/v1/sessions/{id}/runs`。
 * `clientRequestId` 用于幂等；`contextSnapshotId` 须为服务端已授权的快照。
 */
export const createRunRequestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  contextSnapshotId: z.string().uuid(),
  clientRequestId: z.string().trim().min(1).max(200),
});

// --- SSE：`GET /api/v1/runs/{id}/events` 流式事件信封 ---

/** 单条 SSE 事件的 `type` 字段；新增类型须保持 schemaVersion 兼容策略。 */
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

/**
 * 版本化事件信封。`data` 按 `type` 携带载荷，由消费方（如 assistant-ui store）解析。
 * `eventId` + `sequence` 供客户端去重与断线重连游标。
 */
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

export type AssistantEvent = z.infer<typeof assistantEventSchema>;
export type AssistantEventType = z.infer<typeof assistantEventTypeSchema>;

export * from "./ag-ui.js";

// --- OpenAPI：路径索引（详述由 agent-server 与文档同步维护） ---

/** 当前 M3 阶段 API 面的轻量 OpenAPI 骨架，供工具链与契约测试引用。 */
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
    "/api/v1/runs/{id}/ag-ui/events": {
      get: { summary: "Read or replay the AG-UI 1.0 event projection" },
    },
    "/api/v1/runs/{id}/cancel": { post: {} },
    "/api/v1/evidence/{referenceId}": { get: { summary: "Resolve evidence after authorization" } },
    "/api/v1/models": { get: { summary: "List safe model metadata for this deployment" } },
    "/api/v1/plugins": { get: { summary: "List installed plugin status" } },
    "/api/v1/capabilities": { get: { summary: "List registered standard capabilities" } },
  },
} as const;
