/**
 * schemas 根：公共常量 + 共用片段（shared）+ 各 Tool 专用契约（contracts/）。
 * `contracts/` 与 `src/tools/`（MCP registerTool）不同名，避免和协议层目录混淆。
 */
export {
  PLATFORM_GOVERNANCE_META_KEY,
  PRODUCT_A_QUALITY_TREND_TOOL_NAME,
  PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
  PRODUCT_A_TABLE_METADATA_TOOL_NAME,
  PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
  productAGovernanceMetadata,
} from "./constants.js";

export {
  productAQualityTrendInputSchema,
  productAQualityTrendResultSchema,
  type ProductAQualityTrendInput,
  type ProductAQualityTrendResult,
} from "./contracts/quality-trend.js";
export {
  productATableSampleRowsInputSchema,
  productATableSampleRowsResultSchema,
  type ProductATableSampleRowsInput,
  type ProductATableSampleRowsResult,
} from "./contracts/table-sample-rows.js";
export {
  productATableMetadataInputSchema,
  productATableMetadataResultSchema,
  type ProductATableMetadataInput,
  type ProductATableMetadataResult,
} from "./contracts/table-metadata.js";
export {
  productASearchDataAssetsInputSchema,
  productASearchDataAssetsResultSchema,
  type ProductASearchDataAssetsInput,
  type ProductASearchDataAssetsResult,
} from "./contracts/search-data-assets.js";
