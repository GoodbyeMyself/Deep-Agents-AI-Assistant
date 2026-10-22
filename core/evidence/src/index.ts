import { z } from "zod";

export const evidenceSchema = z.object({
  id: z.string().min(1),
  source: z.object({
    type: z.enum(["table", "dataset", "metric", "record", "task", "document", "service"]),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
  }),
  collectedAt: z.iso.datetime({ offset: true }),
  referenceId: z.string().min(1),
  dataScope: z
    .object({
      from: z.iso.datetime({ offset: true }).optional(),
      to: z.iso.datetime({ offset: true }).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  methodology: z.string().min(1).optional(),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const evidenceRecordSchema = z.object({
  referenceId: z.string().min(1),
  ownerId: z.string().min(1),
  tenantId: z.string().min(1),
  runId: z.string().uuid(),
  objectId: z.string().min(1).optional(),
  evidence: evidenceSchema,
  createdAt: z.iso.datetime({ offset: true }),
});

export const resolvedEvidenceSchema = z.object({
  referenceId: z.string().min(1),
  source: evidenceSchema.shape.source,
  collectedAt: z.iso.datetime({ offset: true }),
  dataScope: evidenceSchema.shape.dataScope,
  methodology: z.string().min(1).optional(),
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type ResolvedEvidence = z.infer<typeof resolvedEvidenceSchema>;

export function resolveEvidence(record: EvidenceRecord): ResolvedEvidence {
  return resolvedEvidenceSchema.parse({
    referenceId: record.referenceId,
    source: record.evidence.source,
    collectedAt: record.evidence.collectedAt,
    dataScope: record.evidence.dataScope,
    methodology: record.evidence.methodology,
  });
}
