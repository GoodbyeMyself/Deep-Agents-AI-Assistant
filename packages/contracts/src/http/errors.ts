/**
 * HTTP 统一错误体。所有 4xx/5xx JSON 响应应能通过此 schema（agent-server 负责映射 status）。
 */
import { z } from "zod";

/** Agent Server 标准错误响应（与 HTTP 状态码配套）。 */
export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  traceId: z.string().uuid(),
  details: z.record(z.string(), z.unknown()).optional(),
});
