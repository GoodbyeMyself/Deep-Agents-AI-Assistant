/**
 * MCP 组装层：只负责创建 `McpServer` 并调用各 `register*Tool`。
 *
 * 分层（自外向内）：
 *   http.ts / stdio.ts → server.ts → tools/register* → services/* → api/clients/*
 * 新增 Agent 能力时改 schemas/contracts、services、tools，此处仅追加 `register*Tool` 一行。
 */
import { McpServer } from "@modelcontextprotocol/server";

import type { ProductAMcpServerOptions } from "./tools/deps.js";
import { registerQualityTrendTool } from "./tools/register-quality-trend.js";
import { registerSearchDataAssetsTool } from "./tools/register-search-data-assets.js";
import { registerTableMetadataTool } from "./tools/register-table-metadata.js";
import { registerTableSampleRowsTool } from "./tools/register-table-sample-rows.js";

export type { ProductAMcpServerOptions } from "./tools/deps.js";

export function createProductAMcpServer(options: ProductAMcpServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: "product-a-mcp", version: "0.1.0" },
    { maxToolInputElements: 32 },
  );

  // 新增 Tool 时：实现 registerXxxTool 后在此追加一行即可。
  registerQualityTrendTool(server, options);
  registerTableSampleRowsTool(server, options);
  registerTableMetadataTool(server, options);
  registerSearchDataAssetsTool(server, options);

  return server;
}
