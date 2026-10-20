import { z } from "zod";

export const CAPABILITY_CONTRACT_VERSION = "1.0.0";

export const capabilityErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "UNSUPPORTED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_ERROR",
  "SCHEMA_MISMATCH",
  "INSUFFICIENT_DATA",
  "PROVIDER_UNAVAILABLE",
]);

export type CapabilityErrorCode = z.infer<typeof capabilityErrorCodeSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  source: z.object({
    type: z.enum(["table", "dataset", "metric", "record", "task", "document", "service"]),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  collectedAt: z.iso.datetime({ offset: true }),
  dataScope: z
    .object({
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  methodology: z.string().min(1).optional(),
  referenceId: z.string().min(1),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const capabilityWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const capabilityErrorSchema = z.object({
  code: capabilityErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});

export function createCapabilityResultSchema<DataSchema extends z.ZodType>(dataSchema: DataSchema) {
  return z
    .object({
      status: z.enum(["success", "partial", "error"]),
      data: dataSchema.nullable(),
      evidence: z.array(evidenceSchema),
      dataScope: z
        .object({
          start: z.iso.datetime({ offset: true }).optional(),
          end: z.iso.datetime({ offset: true }).optional(),
          filters: z.record(z.string(), z.unknown()).optional(),
          timezone: z.string().min(1).optional(),
        })
        .optional(),
      warnings: z.array(capabilityWarningSchema),
      error: capabilityErrorSchema.optional(),
    })
    .superRefine((result, context) => {
      const checkedResult = result as unknown as {
        status: "success" | "partial" | "error";
        data: unknown;
        warnings: unknown[];
        error?: unknown;
      };
      if (checkedResult.status === "success" && checkedResult.data === null) {
        context.addIssue({ code: "custom", message: "A successful result must contain data." });
      }
      if (checkedResult.status === "partial" && checkedResult.warnings.length === 0) {
        context.addIssue({ code: "custom", message: "A partial result must explain its limits." });
      }
      if (
        checkedResult.status === "error" &&
        (checkedResult.data !== null || checkedResult.error === undefined)
      ) {
        context.addIssue({
          code: "custom",
          message: "An error result must have null data and a standard error.",
        });
      }
    });
}

export interface CapabilityContract<
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: InputSchema;
  readonly outputSchema: OutputSchema;
  readonly requiredPermission: string;
  readonly riskLevel: "read" | "write" | "high";
}

export function defineCapability<
  const Id extends string,
  const Version extends string,
  InputSchema extends z.ZodType,
  DataSchema extends z.ZodType,
>(definition: {
  readonly id: Id;
  readonly version: Version;
  readonly description: string;
  readonly inputSchema: InputSchema;
  readonly dataSchema: DataSchema;
  readonly requiredPermission: string;
  readonly riskLevel: "read" | "write" | "high";
}) {
  return {
    id: definition.id,
    version: definition.version,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: createCapabilityResultSchema(definition.dataSchema),
    requiredPermission: definition.requiredPermission,
    riskLevel: definition.riskLevel,
  } as const satisfies CapabilityContract;
}

export function capabilityKey(id: string, version: string): string {
  return `${id}@${version}`;
}
