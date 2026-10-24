/** 将 `get_table_metadata` 注册到 MCP（元数据微服务能力）。 */
import type { McpServer } from "@modelcontextprotocol/server";

import {
  PRODUCT_A_TABLE_METADATA_TOOL_NAME,
  productATableMetadataInputSchema,
  productATableMetadataResultSchema,
} from "../schemas/index.js";
import { queryProductATableMetadata } from "../services/metadata/table-metadata.js";
import { productAAuthFromToolContext } from "./auth-from-context.js";
import type { ProductAMcpServerOptions } from "./deps.js";
import { productAReadOnlyToolAnnotations, productAReadOnlyToolMeta } from "./read-only-tool.js";

export function registerTableMetadataTool(
  server: McpServer,
  _options: ProductAMcpServerOptions,
): void {
  server.registerTool(
    PRODUCT_A_TABLE_METADATA_TOOL_NAME,
    {
      title: "Get Product A table metadata",
      description: "Return table profile and lineage summary from Product A metadata service.",
      inputSchema: productATableMetadataInputSchema,
      outputSchema: productATableMetadataResultSchema,
      annotations: productAReadOnlyToolAnnotations,
      _meta: productAReadOnlyToolMeta,
    },
    async (input, context) => {
      const result = await queryProductATableMetadata(
        input,
        productAAuthFromToolContext(context),
      );
      return {
        content: [
          {
            type: "text",
            text:
              result.status === "error"
                ? "Product A could not return table metadata."
                : `Product A metadata for ${result.data?.displayName ?? input.tableId}.`,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
