import { z } from "zod";

/** `POST /api/v1/runs/{id}/resume`；恢复一个由服务端登记的 AG-UI interrupt。 */
export const resumeRunRequestSchema = z.discriminatedUnion("status", [
  z
    .object({
      interruptId: z.string().trim().min(1).max(200),
      status: z.literal("resolved"),
      payload: z.object({ approved: z.literal(true) }).strict(),
      clientRequestId: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      interruptId: z.string().trim().min(1).max(200),
      status: z.literal("cancelled"),
      payload: z.object({ approved: z.literal(false) }).strict().optional(),
      clientRequestId: z.string().trim().min(1).max(200),
    })
    .strict(),
]);

/** 业务 Tool/Graph 通过 LangGraph interrupt 提交的受控审批说明。 */
export const enterpriseApprovalInterruptValueSchema = z
  .object({
    type: z.literal("approval"),
    reason: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1_000),
    toolCallId: z.string().trim().min(1).max(200).optional(),
    responseSchema: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

/** 持久事件中公开的中断内容；不包含原始 Tool 参数或可信执行上下文。 */
export const assistantInterruptSchema = z
  .object({
    id: z.string().min(1).max(200),
    reason: z.string().min(1).max(100),
    message: z.string().min(1).max(1_000).optional(),
    toolCallId: z.string().min(1).max(200).optional(),
    responseSchema: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const runInterruptedDataSchema = z
  .object({ interrupts: z.array(assistantInterruptSchema).min(1) })
  .strict();

export type AssistantInterrupt = z.infer<typeof assistantInterruptSchema>;
export type ResumeRunRequest = z.infer<typeof resumeRunRequestSchema>;
