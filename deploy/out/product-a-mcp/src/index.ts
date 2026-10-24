/**
 * Product A MCP 的库入口：对外导出 Tool Schema/常量与 `createProductAMcpServer`。
 *
 * 进程入口：
 * - `dist/stdio.js` — 本地协议调试
 * - `dist/http.js` — Streamable HTTP（接主平台）
 * 二者均复用本包导出的工厂函数，不在此文件注册 Tool。
 */
export {
  PLATFORM_GOVERNANCE_META_KEY,
  PRODUCT_A_QUALITY_TREND_TOOL_NAME,
  PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
  PRODUCT_A_TABLE_METADATA_TOOL_NAME,
  PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
  productAGovernanceMetadata,
  productAQualityTrendInputSchema,
  productAQualityTrendResultSchema,
  productATableSampleRowsInputSchema,
  productATableSampleRowsResultSchema,
  type ProductAQualityTrendInput,
  type ProductAQualityTrendResult,
  type ProductATableSampleRowsInput,
  type ProductATableSampleRowsResult,
  productATableMetadataInputSchema,
  productATableMetadataResultSchema,
  productASearchDataAssetsInputSchema,
  productASearchDataAssetsResultSchema,
  type ProductATableMetadataInput,
  type ProductATableMetadataResult,
  type ProductASearchDataAssetsInput,
  type ProductASearchDataAssetsResult,
} from "./schemas/index.js";
export { createProductAMcpServer, type ProductAMcpServerOptions } from "./server.js";
