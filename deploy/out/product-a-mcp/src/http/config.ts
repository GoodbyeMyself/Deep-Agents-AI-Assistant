/**
 * Streamable HTTP 监听配置（环境变量驱动）。
 * 详见 `product-a-mcp/README.md` 中的变量表。
 */
export interface ProductAHttpServerConfig {
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly requireBearerAuth: boolean;
  readonly allowedHostnames: string[];
}

function readPort(): number {
  const raw = process.env["PRODUCT_A_MCP_HTTP_PORT"] ?? "3101";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PRODUCT_A_MCP_HTTP_PORT: ${raw}`);
  }
  return port;
}

export function readProductAHttpServerConfig(): ProductAHttpServerConfig {
  const requireBearerAuth =
    (process.env["PRODUCT_A_MCP_REQUIRE_AUTH"] ?? "true").toLowerCase() !== "false";
  const path = process.env["PRODUCT_A_MCP_HTTP_PATH"] ?? "/mcp";
  if (!path.startsWith("/")) {
    throw new Error("PRODUCT_A_MCP_HTTP_PATH must start with '/'.");
  }
  if (process.env["NODE_ENV"] === "production" && !requireBearerAuth)
    throw new Error("Bearer authentication cannot be disabled in production mode.");
  if (process.env["NODE_ENV"] === "production" && process.env["PRODUCT_A_LOCAL_DEMO"] !== "true")
    throw new Error("Enterprise HTTP authentication is not configured; only explicit local demo mode is currently supported.");
  const allowedHostnames = (process.env["PRODUCT_A_MCP_ALLOWED_HOSTS"] ?? "localhost,127.0.0.1,[::1]")
    .split(",").map((host) => host.trim()).filter(Boolean);
  if (!allowedHostnames.length || allowedHostnames.some((host) => !/^[a-zA-Z0-9.\[\]:_-]+$/.test(host)))
    throw new Error("PRODUCT_A_MCP_ALLOWED_HOSTS must be an explicit hostname list.");
  if (process.env["PRODUCT_A_LOCAL_DEMO"] === "true" && (process.env["PRODUCT_A_MCP_DELEGATION_SECRET"]?.length ?? 0) < 64)
    throw new Error("Local HTTP demo requires a strong delegation secret.");

  return {
    host: process.env["PRODUCT_A_MCP_HTTP_HOST"] ?? "127.0.0.1",
    port: readPort(),
    path,
    requireBearerAuth,
    allowedHostnames,
  };
}
