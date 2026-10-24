/** 将 `search_data_assets` 注册到 MCP（元数据目录检索）。 */
import type { McpServer } from "@modelcontextprotocol/server";

import {
  PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
  productASearchDataAssetsInputSchema,
  productASearchDataAssetsResultSchema,
} from "../schemas/index.js";
import { queryProductASearchDataAssets } from "../services/metadata/search-assets.js";
import { productAAuthFromToolContext } from "./auth-from-context.js";
import type { ProductAMcpServerOptions } from "./deps.js";
import { productAReadOnlyToolAnnotations, productAReadOnlyToolMeta } from "./read-only-tool.js";

export function registerSearchDataAssetsTool(
  server: McpServer,
  _options: ProductAMcpServerOptions,
): void {
  server.registerTool(
    PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
    {
      title: "Search Product A data assets",
      description: "Search the Product A metadata catalog for tables, datasets, and metrics.",
      inputSchema: productASearchDataAssetsInputSchema,
      outputSchema: productASearchDataAssetsResultSchema,
      annotations: productAReadOnlyToolAnnotations,
      _meta: productAReadOnlyToolMeta,
    },
    async (input, context) => {
      const result = await queryProductASearchDataAssets(
        input,
        productAAuthFromToolContext(context),
      );
      return {
        content: [
          {
            type: "text",
            text:
              result.status === "error"
                ? "Product A asset search failed."
                : `Product A found ${result.data?.total ?? 0} asset(s) for "${input.keyword}".`,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
