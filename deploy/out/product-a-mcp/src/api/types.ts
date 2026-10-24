/**
 * 微服务集成层内部类型（不进入 MCP Tool 参数）。
 * 接真实系统时与 OpenAPI / 内部 DTO 对齐。
 */
export interface ProductARequestContext {
  readonly subjectId: string;
  readonly tenantId: string;
  /** 转发到 Product A 统一网关的 Bearer（来自平台委托 Token，禁止暴露给 Tool 参数）。 */
  readonly gatewayAccessToken: string;
  /** 允许转发的自定义 HTTP 头（如 X-Product-A-*）。 */
  readonly forwardHeaders: Readonly<Record<string, string>>;
}

/** 元数据微服务：单表技术画像（内部 DTO，非 MCP Tool 出参形状）。 */
export interface MetadataTableDto {
  readonly tableId: string;
  readonly displayName: string;
  readonly domain: string;
  readonly ownerTeam: string;
  readonly tags: readonly string[];
  readonly columnCount: number;
  readonly upstreamTableIds: readonly string[];
  readonly downstreamTableIds: readonly string[];
}

/** 元数据微服务：目录检索命中摘要。 */
export interface DataAssetSummaryDto {
  readonly assetId: string;
  readonly assetType: "table" | "dataset" | "metric";
  readonly name: string;
  readonly domain: string;
}

/** 数据治理微服务：质量趋势单点。 */
export interface QualityTrendPointDto {
  readonly time: string;
  readonly value: number;
}

/** 数据服务微服务：样本行记录（生产环境列集由权限裁剪）。 */
export interface SampleRowDto {
  readonly order_id: string;
  readonly status: string;
  readonly quality_score: number;
}
