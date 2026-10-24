import { createMcpHandler, hostHeaderValidationResponse, localhostAllowedHostnames } from "@modelcontextprotocol/server";

import { createProductAMcpServer } from "../server.js";

/**
 * Streamable HTTP（2026-07-28）入口：每请求一个 `McpServer` 实例。
 * 认证由外层 Node 服务提取 Bearer 后通过 `handler.fetch(..., { authInfo })` 传入。
 */
export function createProductAMcpHttpHandler(allowedHostnames = localhostAllowedHostnames()) {
  const handler = createMcpHandler(() => createProductAMcpServer(), {
    legacy: "stateless",
  });

  return {
    handler,
    async fetch(request: Request, authInfo?: import("@modelcontextprotocol/server").AuthInfo) {
      const hostRejected = hostHeaderValidationResponse(request, allowedHostnames);
      if (hostRejected !== undefined) {
        return hostRejected;
      }
      return handler.fetch(request, authInfo === undefined ? undefined : { authInfo });
    },
    close: () => handler.close(),
  };
}
