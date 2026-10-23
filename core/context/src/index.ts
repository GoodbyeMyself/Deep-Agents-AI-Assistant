import { z } from "zod";

const shortText = z.string().trim().min(1).max(300);
const hostActionDescriptorSchema = z
  .object({
    target: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/),
    label: z.string().trim().min(1).max(80),
  })
  .strict();

export const rawHostContextSchema = z
  .object({
    page: z
      .object({
        route: shortText.optional(),
        title: shortText.optional(),
        type: shortText.optional(),
      })
      .optional(),
    object: z
      .object({
        type: shortText.optional(),
        rawId: shortText.optional(),
        name: shortText.optional(),
      })
      .optional(),
    business: z.object({ domain: shortText.optional(), module: shortText.optional() }).optional(),
    hostActions: z.array(hostActionDescriptorSchema).max(20).optional(),
    metadata: z
      .record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean()]))
      .optional(),
  })
  .strip();

export const normalizedContextSchema = z.object({
  user: z.object({ id: shortText, displayName: shortText.optional() }),
  permissions: z.object({ scopes: z.array(shortText).max(100) }),
  page: z
    .object({ type: shortText, route: shortText.optional(), title: shortText.optional() })
    .optional(),
  object: z.object({ type: shortText, id: shortText, name: shortText.optional() }).optional(),
  business: z.object({ domain: shortText, module: shortText.optional() }).optional(),
  hostActions: z.array(hostActionDescriptorSchema).max(20).optional(),
});

export const contextSnapshotSchema = z.object({
  id: z.string().uuid(),
  version: z.literal(1),
  ownerId: shortText,
  tenantId: shortText,
  mode: z.enum(["assistant", "standalone"]),
  capturedAt: z.iso.datetime({ offset: true }),
  context: normalizedContextSchema,
});

export const trustedExecutionContextSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  runId: z.string().uuid(),
  traceId: z.string().uuid(),
  authenticatedUserId: shortText,
  tenantId: shortText,
  contextSnapshotId: z.string().uuid(),
  authorizationRef: shortText,
});

export type RawHostContext = z.infer<typeof rawHostContextSchema>;
export type NormalizedContext = z.infer<typeof normalizedContextSchema>;
export type ContextSnapshot = z.infer<typeof contextSnapshotSchema>;
export type TrustedExecutionContext = z.infer<typeof trustedExecutionContextSchema>;

export interface VerifiedPrincipal {
  readonly id: string;
  readonly displayName: string;
  readonly tenantId: string;
  readonly permissionScopes: readonly string[];
  readonly authorizedObjectIds: readonly string[];
  readonly authorizationRef: string;
}

export interface ContextAuthorizer {
  normalize(raw: RawHostContext, principal: VerifiedPrincipal): Promise<NormalizedContext>;
}
