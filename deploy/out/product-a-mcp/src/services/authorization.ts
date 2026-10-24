/**
 * 对象级授权（Mock）。
 * 接真实 Product A 后：在此或 API 客户端根据服务端恢复的主体调用原系统鉴权，
 * 禁止把 userId / Token 放进 Tool 参数。
 */
export const PRODUCT_A_MOCK_AUTHORIZED_TABLE_ID = "orders";

/** 与 Product A 各 Tool 共用的 FORBIDDEN 错误体（写入 structuredContent.error）。 */
export function createProductAForbiddenError() {
  return {
    code: "FORBIDDEN" as const,
    message: "Product A denied this business object.",
    retryable: false,
  };
}

/**
 * Mock 对象级预检。接真系统后应改为调权限 API，或删除预检并依赖网关/API 的 403 映射。
 */
export function isAuthorizedProductATable(tableId: string): boolean {
  return tableId === PRODUCT_A_MOCK_AUTHORIZED_TABLE_ID;
}
