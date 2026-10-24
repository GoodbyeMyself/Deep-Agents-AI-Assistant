/**
 * Product A「数据治理」微服务客户端（质量指标等，当前 Mock）。
 * 真接入时通过统一网关调用治理 API，不在 MCP 层做指标口径归一化。
 */
import type { ProductARequestContext, QualityTrendPointDto } from "../types.js";

/** 治理服务查询质量趋势的请求体（内部 DTO）。 */
export interface GovernanceQualityTrendRequest {
  readonly tableId: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface GovernanceQualityTrendResponse {
  readonly points: readonly QualityTrendPointDto[];
  readonly missingDates: readonly string[];
}

/** 计算开区间 [start, end) 内缺失的日历日（Mock 用于演示 partial 数据）。 */
function listMissingDates(startTime: string, endTime: string): string[] {
  const current = new Date(`${startTime.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${endTime.slice(0, 10)}T00:00:00Z`);
  const dates: string[] = [];
  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** 模拟「数据治理微服务」：质量趋势时序。 */
export async function dataGovernanceServiceGetQualityTrend(
  request: GovernanceQualityTrendRequest,
  _ctx: ProductARequestContext,
  signal: AbortSignal,
): Promise<GovernanceQualityTrendResponse> {
  signal.throwIfAborted();
  const missingDates = listMissingDates(request.startTime, request.endTime);
  return {
    points: [{ time: request.endTime.slice(0, 10), value: 96 }],
    missingDates,
  };
}
