/** 本地开发入口：stdio 传输。生产环境应使用带 TLS 的 Streamable HTTP（见 MCP 仓架构文档）。 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createProductAMcpServer } from "./server.js";

void serveStdio(() => createProductAMcpServer());
