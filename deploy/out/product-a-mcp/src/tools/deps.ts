/**
 * `createProductAMcpServer` 可选依赖与生命周期钩子。
 *
 * 鉴权生产路径不依赖这些钩子（走 HTTP `authInfo` → `auth-context`）；
 * 钩子主要用于单测验证 AbortSignal 传播，或将来插入审计/限流。
 */
import type {
  ProductAQualityTrendInput,
  ProductATableSampleRowsInput,
} from "../schemas/index.js";

export interface ProductAMcpServerOptions {
  /** 在质量趋势 handler 执行业务前调用（测试用于验证 AbortSignal 传播）。 */
  readonly beforeQuery?: (input: ProductAQualityTrendInput, signal: AbortSignal) => Promise<void>;
  /** 在样本行 handler 执行业务前调用。 */
  readonly beforeListTableSampleRows?: (
    input: ProductATableSampleRowsInput,
    signal: AbortSignal,
  ) => Promise<void>;
}
