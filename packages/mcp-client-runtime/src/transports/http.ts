import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { McpClientConnection } from "./stdio.js";

export interface ApprovedHttpMcpEndpoint {
  readonly serverId: string;
  readonly endpoint: string;
  readonly allowedHosts: readonly string[];
  /** Explicit local Docker/loopback demo exception; production deployments require HTTPS. */
  readonly localDemoHttp?: boolean;
}

function localAddress(address: string): boolean {
  return address === "::1" || /^127\./.test(address) || /^10\./.test(address)
    || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
    || /^f[cd][0-9a-f]{2}:/i.test(address);
}

function publicAddress(address: string): boolean {
  if (isIP(address) === 6) return /^[23][0-9a-f]{0,3}:/i.test(address);
  const first = Number(address.split(".")[0]);
  return isIP(address) === 4 && first > 0 && first < 224 && !localAddress(address)
    && !/^169\.254\./.test(address) && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)
    && !/^198\.(18|19)\./.test(address);
}

export function validateHttpMcpEndpoint(config: ApprovedHttpMcpEndpoint): URL {
  const url = new URL(config.endpoint);
  if (url.username || url.password || url.search || url.hash || !config.allowedHosts.includes(url.host))
    throw new Error("MCP endpoint must match an approved host/port and contain no credentials, query or fragment.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && config.localDemoHttp === true))
    throw new Error("MCP HTTP connections require HTTPS; plaintext is restricted to explicit local demo configuration.");
  return url;
}

/** DNS-pinned, bounded HTTP fetch; never follows redirects, proxies, or OAuth-discovered URLs. */
export function createRestrictedMcpFetch(config: ApprovedHttpMcpEndpoint): typeof fetch {
  const endpoint = validateHttpMcpEndpoint(config);
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== endpoint.origin || url.pathname !== endpoint.pathname || url.search || url.hash)
      throw new Error("MCP request target is outside its approved endpoint.");
    request.signal.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true });
    if (addresses.length === 0 || addresses.some(({ address }) =>
      config.localDemoHttp === true ? !localAddress(address) : !publicAddress(address)))
      throw new Error("MCP DNS resolution is outside the approved network scope.");
    const address = addresses[0]!;
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : Buffer.from(await request.arrayBuffer());
    if (body !== undefined && body.length > 256 * 1024) throw new Error("MCP request is too large.");
    const headers = Object.fromEntries(request.headers.entries());
    return new Promise<Response>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const outgoing = send(url, {
        method: request.method, headers, family: address.family,
        signal: request.signal, timeout: 30_000,
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      }, (incoming) => {
        const status = incoming.statusCode ?? 500;
        if (status >= 300 && status < 400) {
          incoming.destroy(); outgoing.destroy(); reject(new Error("MCP redirects are forbidden.")); return;
        }
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) {
            incoming.destroy(); outgoing.destroy(); reject(new Error("MCP HTTP response is too large."));
          } else chunks.push(chunk);
        });
        incoming.on("error", reject);
        incoming.on("end", () => resolve(new Response(
          status === 204 || status === 205 || status === 304 || request.method === "HEAD"
            ? null : new Uint8Array(Buffer.concat(chunks)), { status, headers: responseHeaders })));
      });
      outgoing.on("timeout", () => outgoing.destroy(new Error("MCP HTTP request timed out.")));
      outgoing.on("error", reject);
      outgoing.end(body);
    });
  };
}

export async function connectApprovedHttpMcp(config: ApprovedHttpMcpEndpoint, token: () => Promise<string>): Promise<McpClientConnection> {
  const client = new Client({ name: "assistant-http-host", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(validateHttpMcpEndpoint(config), {
    fetch: createRestrictedMcpFetch(config), authProvider: { token }, requestInit: { redirect: "error" },
  });
  try {
    await client.connect(transport, { timeout: 10_000 });
    const protocolEra = client.getProtocolEra();
    if (protocolEra === undefined) throw new Error("MCP protocol negotiation did not complete.");
    return { client, serverId: config.serverId, protocolEra, close: () => client.close() };
  } catch { await client.close().catch(() => undefined); throw new Error(`MCP HTTP connection failed for '${config.serverId}'.`); }
}
