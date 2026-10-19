import { z } from "zod";

import {
  CAPABILITY_CONTRACT_VERSION,
  createCapabilityResultSchema,
  type CapabilityContract,
} from "../common.js";

export const dataMapSearchObjectsInputSchema = z
  .object({
    keyword: z.string().trim().min(1).max(200),
    objectTypes: z.array(z.string().min(1)).max(20).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    scope: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const dataMapObjectSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sourceRef: z.string().min(1),
});

export const dataMapSearchObjectsDataSchema = z.object({
  objects: z.array(dataMapObjectSchema),
  nextCursor: z.string().min(1).optional(),
});

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
