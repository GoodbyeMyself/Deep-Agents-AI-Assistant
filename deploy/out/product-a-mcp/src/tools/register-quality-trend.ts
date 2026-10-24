/** 将 `get_quality_trend` 注册到 MCP；handler 只做钩子 + 调 service + 返回 content/structuredContent。 */
import type { McpServer } from "@modelcontextprotocol/server";

import {
  PRODUCT_A_QUALITY_TREND_TOOL_NAME,
  productAQualityTrendInputSchema,
  productAQualityTrendResultSchema,
} from "../schemas/index.js";
import { queryProductAQualityTrend } from "../services/governance/quality-trend.js";
import { productAAuthFromToolContext } from "./auth-from-context.js";
import type { ProductAMcpServerOptions } from "./deps.js";
import { productAReadOnlyToolAnnotations, productAReadOnlyToolMeta } from "./read-only-tool.js";

export function registerQualityTrendTool(
  server: McpServer,
  options: ProductAMcpServerOptions,
): void {
  server.registerTool(
    PRODUCT_A_QUALITY_TREND_TOOL_NAME,
    {
      title: "Get Product A quality trend",
      description: "Return an authorized Product A daily quality-score trend.",
      inputSchema: productAQualityTrendInputSchema,
      outputSchema: productAQualityTrendResultSchema,
      annotations: productAReadOnlyToolAnnotations,
      _meta: productAReadOnlyToolMeta,
    },
    async (input, context) => {
      await options.beforeQuery?.(input, context.mcpReq.signal);
      const result = await queryProductAQualityTrend(
        input,
        productAAuthFromToolContext(context),
      );
      return {
        content: [
          {
            type: "text",
            text:
              result.status === "error"
                ? "Product A denied this quality query."
                : `Product A returned ${result.data?.points.length ?? 0} quality point(s).`,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
