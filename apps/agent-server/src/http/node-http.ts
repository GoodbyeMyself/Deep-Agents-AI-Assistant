import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

class NodeRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readBody(request: IncomingMessage): Promise<Uint8Array | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    const unknownChunk: unknown = chunk;
    const bytes =
      typeof unknownChunk === "string"
        ? Buffer.from(unknownChunk)
        : unknownChunk instanceof Uint8Array
          ? unknownChunk
          : undefined;
    if (bytes === undefined)
      throw new NodeRequestError("INVALID_REQUEST_BODY", 400, "Invalid request body.");
    size += bytes.byteLength;
    if (size > 64 * 1024)
      throw new NodeRequestError("PAYLOAD_TOO_LARGE", 413, "Request body is too large.");
    chunks.push(bytes);
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

async function dispatch(
  request: IncomingMessage,
  response: ServerResponse,
  handler: (request: Request) => Promise<Response>,
): Promise<void> {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(name, item);
      else if (value !== undefined) headers.set(name, value);
    }
    const host = headers.get("host") ?? "127.0.0.1";
    const requestBody = await readBody(request);
    const webRequest = new Request(`http://${host}${request.url ?? "/"}`, {
      method: request.method ?? "GET",
      headers,
      ...(requestBody === undefined ? {} : { body: requestBody }),
    });
    const webResponse = await handler(webRequest);
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    if (webResponse.body === null) {
      response.end();
      return;
    }
    const reader = webResponse.body.getReader();
    let disconnected = false;
    let cancellation: Promise<void> | undefined;
    const cancelReader = () => {
      if (response.writableEnded) return;
      disconnected = true;
      cancellation ??= reader.cancel("HTTP client disconnected");
    };
    response.once("close", cancelReader);
    try {
      while (!disconnected) {
        const result = await reader.read();
        if (result.done) break;
        if (result.value !== undefined && !response.destroyed)
          response.write(Buffer.from(result.value));
      }
      if (!response.destroyed) response.end();
      await cancellation;
    } finally {
      response.off("close", cancelReader);
    }
  } catch (error) {
    const safe =
      error instanceof NodeRequestError
        ? error
        : new NodeRequestError("INTERNAL_ERROR", 500, "An internal error occurred.");
    response.statusCode = safe.status;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ code: safe.code, message: safe.message, traceId: randomUUID() }));
  }
}

export function createNodeHttpServer(handler: (request: Request) => Promise<Response>): Server {
  return createServer((request, response) => {
    void dispatch(request, response, handler);
  });
}
