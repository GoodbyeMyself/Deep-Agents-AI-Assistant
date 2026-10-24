/**
 * Product A「数据服务」微服务客户端（受控抽样查询，当前 Mock）。
 * 生产环境必须由服务端执行行/列级权限与脱敏；MCP 只传递业务查询条件。
 */
import type { ProductARequestContext, SampleRowDto } from "../types.js";

const MOCK_ORDER_ROWS: readonly SampleRowDto[] = Object.freeze([
  { order_id: "ord-1001", status: "completed", quality_score: 98 },
  { order_id: "ord-1002", status: "processing", quality_score: 91 },
  { order_id: "ord-1003", status: "completed", quality_score: 96 },
]);

/** 模拟「数据服务微服务」：受控样本行查询。 */
export async function dataServiceListSampleRows(
  tableId: string,
  limit: number,
  _ctx: ProductARequestContext,
  signal: AbortSignal,
): Promise<{ readonly columns: readonly string[]; readonly rows: readonly SampleRowDto[] }> {
  signal.throwIfAborted();
  if (tableId !== "orders") {
    return { columns: [], rows: [] };
  }
  const columns = ["order_id", "status", "quality_score"];
  return {
    columns,
    rows: MOCK_ORDER_ROWS.slice(0, limit),
  };
}

export function dataServiceTotalSampleRowCount(tableId: string): number {
  return tableId === "orders" ? MOCK_ORDER_ROWS.length : 0;
}
