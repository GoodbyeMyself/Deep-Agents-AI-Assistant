/**
 * Session / Run 写操作请求体。不含 Context 正文：Run 仅引用已授权的 contextSnapshotId。
 */
import { z } from "zod";

/** `POST /api/v1/sessions` */
export const createSessionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  /** assistant：嵌入/助手 Shell；standalone：独立 Web 会话壳。 */
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
