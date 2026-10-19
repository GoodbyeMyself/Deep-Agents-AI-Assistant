import { z } from "zod";

export const runContextSchema = z.object({
  executionContextId: z.string().min(1),
  contextSnapshotId: z.string().min(1),
  traceId: z.string().min(1).optional(),
  principalId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  sessionId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  authorizationRef: z.string().min(1).optional(),
  contextObjectId: z.string().min(1).optional(),
  authorizedObjectIds: z.array(z.string().min(1)).optional(),
  permissionScopes: z.array(z.string().min(1)).optional(),
});

export type RunContext = z.infer<typeof runContextSchema>;
