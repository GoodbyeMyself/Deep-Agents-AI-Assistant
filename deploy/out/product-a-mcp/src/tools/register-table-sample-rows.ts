/** 将 `list_table_sample_rows` 注册到 MCP。 */
import type { McpServer } from "@modelcontextprotocol/server";

import {
  PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
  productATableSampleRowsInputSchema,
  productATableSampleRowsResultSchema,
} from "../schemas/index.js";
import { queryProductATableSampleRows } from "../services/data-service/sample-rows.js";
import { productAAuthFromToolContext } from "./auth-from-context.js";
import type { ProductAMcpServerOptions } from "./deps.js";
import { productAReadOnlyToolAnnotations, productAReadOnlyToolMeta } from "./read-only-tool.js";

export function registerTableSampleRowsTool(
  server: McpServer,
  options: ProductAMcpServerOptions,
): void {
  server.registerTool(
    PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
    {
      title: "List Product A table sample rows",
      description: "Return authorized sample rows for one Product A table.",
      inputSchema: productATableSampleRowsInputSchema,
      outputSchema: productATableSampleRowsResultSchema,
      annotations: productAReadOnlyToolAnnotations,
      _meta: productAReadOnlyToolMeta,
    },
    async (input, context) => {
      await options.beforeListTableSampleRows?.(input, context.mcpReq.signal);
      const result = await queryProductATableSampleRows(
        input,
        productAAuthFromToolContext(context),
      );
      return {
        content: [
          {
            type: "text",
            text:
              result.status === "error"
                ? "Product A denied this sample-row query."
                : `Product A returned ${result.data?.rows.length ?? 0} sample row(s).`,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
