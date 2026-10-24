/**
 * Product A「元数据」微服务客户端（当前为内存 Mock）。
 *
 * 接真系统时：保留函数签名，内部改为 `gatewayFetch(ctx, '/api/...', { signal })`，
 * 并将 HTTP 4xx/5xx 映射为业务错误；`_ctx` 在 Mock 阶段未使用，真接入后用于组 Header。
 */
import type { DataAssetSummaryDto, MetadataTableDto, ProductARequestContext } from "../types.js";

/** Mock 表目录；键为业务 tableId。 */
const MOCK_TABLES: Readonly<Record<string, MetadataTableDto>> = Object.freeze({
  orders: {
    tableId: "orders",
    displayName: "订单事实表",
    domain: "交易",
    ownerTeam: "Data Platform East",
    tags: ["core", "pii-lite"],
    columnCount: 42,
    upstreamTableIds: ["raw_orders", "dim_customer"],
    downstreamTableIds: ["mart_order_quality_daily"],
  },
});

const MOCK_ASSETS: readonly DataAssetSummaryDto[] = Object.freeze([
  { assetId: "asset-orders", assetType: "table", name: "orders", domain: "交易" },
  { assetId: "asset-customers", assetType: "table", name: "dim_customer", domain: "客户" },
  { assetId: "asset-quality", assetType: "metric", name: "order_quality_score", domain: "治理" },
]);

/** 模拟「元数据微服务」：表详情与血缘。 */
export async function metadataServiceGetTable(
  tableId: string,
  _ctx: ProductARequestContext,
  signal: AbortSignal,
): Promise<MetadataTableDto | null> {
  signal.throwIfAborted();
  return MOCK_TABLES[tableId] ?? null;
}

/** 模拟「元数据微服务」：资产目录关键字检索。 */
export async function metadataServiceSearchAssets(
  keyword: string,
  limit: number,
  _ctx: ProductARequestContext,
  signal: AbortSignal,
): Promise<readonly DataAssetSummaryDto[]> {
  signal.throwIfAborted();
  const normalized = keyword.trim().toLowerCase();
  const matched = MOCK_ASSETS.filter(
    (asset) =>
      asset.name.toLowerCase().includes(normalized) ||
      asset.domain.toLowerCase().includes(normalized),
  );
  return matched.slice(0, limit);
}
