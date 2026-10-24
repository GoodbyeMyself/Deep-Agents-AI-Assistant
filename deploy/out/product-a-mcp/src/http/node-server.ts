/**
 * 将 Node.js `http.IncomingMessage` 转为 Web `Request`，并交给 MCP `handler.fetch`。
 * 仅处理 `config.path`（默认 `/mcp`）；TLS 终止通常在前置反向代理完成。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { ProductAHttpServerConfig } from "./config.js";
import { resolveAuthInfoFromRequest, unauthorizedResponse } from "./verify-bearer.js";

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += part.length;
    if (bytes > 256 * 1024) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(part);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function toWebRequest(req: IncomingMessage, body: Buffer | undefined, publicOrigin: string): Request {
  const url = new URL(req.url ?? "/", publicOrigin);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(name, entry);
      }
    } else {
      headers.set(name, value);
    }
  }

  const init: RequestInit = {
    method: req.method ?? "GET",
    headers,
  };
  if (body !== undefined) {
    init.body = new Uint8Array(body);
  }
  return new Request(url, init);
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

export interface ProductAMcpHttpApp {
  fetch(request: Request, authInfo?: import("@modelcontextprotocol/server").AuthInfo): Promise<Response>;
  close(): Promise<void>;
}

export function startProductAMcpNodeHttpServer(
  app: ProductAMcpHttpApp,
  config: ProductAHttpServerConfig,
): void {
  const publicOrigin = `http://${config.host}:${config.port}`;

  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", publicOrigin).pathname;
      if (pathname === "/health" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"status":"ready","businessData":"mock"}');
        return;
      }
      if (pathname !== config.path) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      const body = await readRequestBody(req);
      const request = toWebRequest(req, body, publicOrigin);

      // Token 校验在 MCP SDK 之外完成；通过后 authInfo 随 fetch 传入，Tool 内经 auth-context 转网关 Bearer。
      const authInfo = resolveAuthInfoFromRequest(request);
      if (config.requireBearerAuth && authInfo === undefined) {
        await writeWebResponse(res, unauthorizedResponse());
        return;
      }

      const response = await app.fetch(request, authInfo);
      await writeWebResponse(res, response);
    } catch (error) {
      console.error("product-a-mcp HTTP request failed.");
      if (!res.headersSent) {
        const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
        res.statusCode = tooLarge ? 413 : 500;
        res.end(tooLarge ? "Payload Too Large" : "Internal Server Error");
      }
    }
  });

  server.listen(config.port, config.host, () => {
    console.error(
      `product-a-mcp Streamable HTTP listening on http://${config.host}:${config.port}${config.path}`,
    );
  });

  const shutdown = () => {
    void app.close().finally(() => {
      server.close();
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
