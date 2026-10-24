/**
 * MCP 原生 Tool 名称与平台治理元数据键。
 * Tool 名会出现在 `tools/list` 与主平台批准配置 `toolName` 中，变更需同步 schemaDigest。
 */
// --- 数据治理 ---
export const PRODUCT_A_QUALITY_TREND_TOOL_NAME = "get_quality_trend";
// --- 数据服务 ---
export const PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME = "list_table_sample_rows";
// --- 元数据 ---
export const PRODUCT_A_TABLE_METADATA_TOOL_NAME = "get_table_metadata";
export const PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME = "search_data_assets";

export const PLATFORM_GOVERNANCE_META_KEY = "com.deep-agents.platform/governance";

/** 主平台读取此 _meta 做 Tool 批准与风险分级，不包含业务 capabilityId。 */
export const productAGovernanceMetadata = Object.freeze({
  protocolVersion: "1",
  riskLevel: "read",
});
