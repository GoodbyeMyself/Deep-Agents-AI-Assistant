/**
 * 只读 Tool 在 MCP 上的通用 annotations 与平台治理 _meta。
 * 写操作类 Tool 需单独定义 riskLevel 与 destructiveHint。
 */
import {
  PLATFORM_GOVERNANCE_META_KEY,
  productAGovernanceMetadata,
} from "../schemas/constants.js";

export const productAReadOnlyToolAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export const productAReadOnlyToolMeta = Object.freeze({
  [PLATFORM_GOVERNANCE_META_KEY]: productAGovernanceMetadata,
});
