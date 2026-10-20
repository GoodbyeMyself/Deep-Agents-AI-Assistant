import { z } from "zod";

import { defineCapability, implementCapability } from "./index.js";

const metadataLookupV1 = defineCapability({
  id: "acme.metadata.get",
  version: "1.0.0",
  description: "Read metadata for an authorized object.",
  inputSchema: z
    .object({
      objectId: z.string().min(1),
      includeColumns: z.boolean().optional(),
    })
    .strict(),
  dataSchema: z.object({
    objectId: z.string(),
    columnCount: z.number().int().nonnegative(),
  }),
  requiredPermission: "metadata:read",
  riskLevel: "read",
});

const metadataLookupImplementation = implementCapability({
  contract: metadataLookupV1,
  execute: (input) =>
    Promise.resolve({
      status: "success",
      data: {
        objectId: input.objectId,
        columnCount: input.includeColumns === true ? 3 : 0,
      },
      evidence: [],
      warnings: [],
    }),
});

const literalCapabilityId: "acme.metadata.get" = metadataLookupImplementation.id;
const literalContractVersion: "1.0.0" = metadataLookupImplementation.contractVersion;
type MetadataLookupInput = z.output<typeof metadataLookupV1.inputSchema>;
const validInput: MetadataLookupInput = { objectId: "orders", includeColumns: true };
type MetadataLookupOutput = z.input<typeof metadataLookupV1.outputSchema>;

// @ts-expect-error objectId must remain a string instead of degrading to any.
const invalidInput: MetadataLookupInput = { objectId: 123 };
const invalidOutput: MetadataLookupOutput = {
  status: "success",
  data: {
    objectId: "orders",
    // @ts-expect-error columnCount must remain a number instead of degrading to any.
    columnCount: "3",
  },
  evidence: [],
  warnings: [],
};

void literalCapabilityId;
void literalContractVersion;
void validInput;
void invalidInput;
void invalidOutput;
