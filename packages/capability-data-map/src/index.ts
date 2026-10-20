import {
  CAPABILITY_CONTRACT_VERSION,
  createCapabilityResultSchema,
  type CapabilityContract,
  type PlatformCapabilitySource,
} from "@assistant/capability-core";
import { z } from "zod";

export const DATA_MAP_CAPABILITY_SOURCE = {
  type: "platform",
  id: "@assistant/capability-data-map",
} as const satisfies PlatformCapabilitySource;

export const dataMapSearchObjectsInputSchema = z
  .object({
    keyword: z.string().trim().min(1).max(200),
    objectTypes: z.array(z.string().min(1)).max(20).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    scope: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const dataMapObjectSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    sourceRef: z.string().min(1),
  })
  .strict();

export const dataMapSearchObjectsDataSchema = z
  .object({
    objects: z.array(dataMapObjectSchema),
    nextCursor: z.string().min(1).optional(),
  })
  .strict();

export const dataMapSearchObjectsResultSchema = createCapabilityResultSchema(
  dataMapSearchObjectsDataSchema,
);

export type DataMapSearchObjectsInput = z.infer<typeof dataMapSearchObjectsInputSchema>;
export type DataMapSearchObjectsData = z.infer<typeof dataMapSearchObjectsDataSchema>;
export type DataMapSearchObjectsResult = z.infer<typeof dataMapSearchObjectsResultSchema>;

export const dataMapSearchObjectsV1 = {
  id: "data_map.search_objects",
  version: CAPABILITY_CONTRACT_VERSION,
  description: "Search authorized business data objects using the standard data-map contract.",
  inputSchema: dataMapSearchObjectsInputSchema,
  outputSchema: dataMapSearchObjectsResultSchema,
  requiredPermission: "data_map:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

export const dataMapGetObjectMetadataInputSchema = z
  .object({
    objectType: z.string().trim().min(1).max(100),
    objectId: z.string().trim().min(1).max(200),
    fieldNames: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  })
  .strict();

export const dataMapMetadataFieldSchema = z
  .object({
    name: z.string().min(1),
    displayName: z.string().min(1).optional(),
    dataType: z.enum(["string", "number", "boolean", "date", "datetime", "object", "array"]),
    nullable: z.boolean(),
    description: z.string().optional(),
    classification: z.enum(["public", "internal", "confidential", "restricted"]),
  })
  .strict();

export const dataMapGetObjectMetadataDataSchema = z
  .object({
    object: z
      .object({
        type: z.string().min(1),
        id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
      })
      .strict(),
    fields: z.array(dataMapMetadataFieldSchema),
  })
  .strict();

export const dataMapGetObjectMetadataResultSchema = createCapabilityResultSchema(
  dataMapGetObjectMetadataDataSchema,
).superRefine((result, context) => {
  if (result.status !== "error" && result.evidence.length === 0) {
    context.addIssue({ code: "custom", message: "Metadata results require source evidence." });
  }
});

export type DataMapGetObjectMetadataInput = z.infer<
  typeof dataMapGetObjectMetadataInputSchema
>;
export type DataMapGetObjectMetadataData = z.infer<typeof dataMapGetObjectMetadataDataSchema>;
export type DataMapGetObjectMetadataResult = z.infer<
  typeof dataMapGetObjectMetadataResultSchema
>;

export const dataMapGetObjectMetadataV1 = {
  id: "data_map.get_object_metadata",
  version: CAPABILITY_CONTRACT_VERSION,
  description:
    "Get authorized and field-filtered metadata for one business data object without exposing field values.",
  inputSchema: dataMapGetObjectMetadataInputSchema,
  outputSchema: dataMapGetObjectMetadataResultSchema,
  requiredPermission: "data_map:read",
  riskLevel: "read",
} as const satisfies CapabilityContract;

export const dataMapCapabilityContracts = [
  dataMapSearchObjectsV1,
  dataMapGetObjectMetadataV1,
] as const;
