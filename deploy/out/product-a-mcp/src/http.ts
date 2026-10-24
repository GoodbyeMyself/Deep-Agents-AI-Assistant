/**
 * 生产向入口：MCP Streamable HTTP（SDK `createMcpHandler`）。
 * 本地开发可设 `PRODUCT_A_MCP_REQUIRE_AUTH=false` 跳过 Bearer（勿用于生产）。
 */
import { readProductAHttpServerConfig } from "./http/config.js";
import { createProductAMcpHttpHandler } from "./http/create-handler.js";
import { startProductAMcpNodeHttpServer } from "./http/node-server.js";

const config = readProductAHttpServerConfig();
const { fetch, close } = createProductAMcpHttpHandler(config.allowedHostnames);

startProductAMcpNodeHttpServer({ fetch, close }, config);
