/**
 * Tool `list_table_sample_rows` 用例：调用数据服务获取受控样本行。
 */
import type { ProductAAuthSource } from "../../api/auth-source.js";
import { resolveProductARequestContext } from "../../api/auth-context.js";
import {
  dataServiceListSampleRows,
  dataServiceTotalSampleRowCount,
} from "../../api/clients/data-service.js";
import type {
  ProductATableSampleRowsInput,
  ProductATableSampleRowsResult,
} from "../../schemas/index.js";
import { createProductAForbiddenError, isAuthorizedProductATable } from "../authorization.js";

export async function queryProductATableSampleRows(
  input: ProductATableSampleRowsInput,
  auth: ProductAAuthSource,
): Promise<ProductATableSampleRowsResult> {
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
  const { columns, rows } = await dataServiceListSampleRows(
    input.tableId,
    input.limit,
    ctx,
    auth.signal,
  );

  const totalAvailable = dataServiceTotalSampleRowCount(input.tableId);
  const truncated = totalAvailable > rows.length;

  return {
    status: "success",
    data: {
      tableId: input.tableId,
      columns: [...columns],
      rows: rows.map((row) => ({ ...row })),
      ...(truncated ? { truncated: true } : {}),
    },
    evidence: [
      {
        id: "product-a-sample-rows-evidence",
        source: { type: "table", id: input.tableId },
        collectedAt: "2026-10-22T09:00:00+08:00",
        methodology: "Product A data-service sample rows with column-level authorization.",
        referenceId: `product-a:mcp:sample-rows:${input.tableId}`,
      },
    ],
    warnings: [],
  };
}
