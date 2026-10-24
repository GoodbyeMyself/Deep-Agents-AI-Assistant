/**
 * Tool `get_table_metadata` 用例：表画像 + 上下游血缘摘要。
 */
import type { ProductAAuthSource } from "../../api/auth-source.js";
import { resolveProductARequestContext } from "../../api/auth-context.js";
import { metadataServiceGetTable } from "../../api/clients/metadata-service.js";
import type { ProductATableMetadataInput, ProductATableMetadataResult } from "../../schemas/index.js";
import { createProductAForbiddenError, isAuthorizedProductATable } from "../authorization.js";

export async function queryProductATableMetadata(
  input: ProductATableMetadataInput,
  auth: ProductAAuthSource,
): Promise<ProductATableMetadataResult> {
  if (!isAuthorizedProductATable(input.tableId)) {
    return {
      status: "error",
      data: null,
      evidence: [],
      warnings: [],
      error: createProductAForbiddenError(),
    };
  }

  const ctx = resolveProductARequestContext(auth);
  const table = await metadataServiceGetTable(input.tableId, ctx, auth.signal);
  if (table === null) {
    return {
      status: "error",
      data: null,
      evidence: [],
      warnings: [],
      error: {
        code: "INSUFFICIENT_DATA",
        message: "Product A metadata service has no record for this table.",
        retryable: false,
      },
    };
  }

  const lineage = [
    ...table.upstreamTableIds.map((tableId) => ({ tableId, direction: "upstream" as const })),
    ...table.downstreamTableIds.map((tableId) => ({ tableId, direction: "downstream" as const })),
  ];

  return {
    status: "success",
    data: {
      tableId: table.tableId,
      displayName: table.displayName,
      domain: table.domain,
      ownerTeam: table.ownerTeam,
      tags: [...table.tags],
      columnCount: table.columnCount,
      lineage,
    },
    evidence: [
      {
        id: "product-a-table-metadata-evidence",
        source: { type: "table", id: input.tableId },
        collectedAt: "2026-10-22T10:00:00+08:00",
        methodology: "Product A metadata service table profile and lineage summary.",
        referenceId: `product-a:mcp:metadata:${input.tableId}`,
      },
    ],
    warnings: [],
  };
}
