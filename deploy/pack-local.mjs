// User-invoked only: this command invokes pnpm. Each repository builds its own artifacts.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mcpRoot = resolve(process.env.MCP_REPO_PATH ?? resolve(root, "../Deep-Agents-AI-Assistant-MCP"));
const manifest = resolve(mcpRoot, "deploy/out/product-a-mcp/approvals.json");
if (!existsSync(manifest)) throw new Error("Run pnpm pack:product-a yourself in the MCP repository first.");
const approvals = JSON.parse(readFileSync(manifest, "utf8"));
if (!Array.isArray(approvals) || approvals.length === 0 || approvals.some((entry) =>
  !entry || typeof entry.toolName !== "string" || !/^[a-f0-9]{64}$/.test(entry.schemaDigest) || entry.riskLevel !== "read"))
  throw new Error("Invalid reviewed MCP deployment approval artifact.");
const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["pack:deploy"], {
  cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env,
    VITE_IDENTITY_MODE: "external", VITE_IDENTITY_LOGIN_URL: "http://127.0.0.1:19001/user/login",
    VITE_ASSISTANT_WEB_URL: "http://127.0.0.1:8080/assistant" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync(resolve(root, "deploy/out/local-mcp-approval.json"), JSON.stringify([
  { serverId: "product-a-mcp", endpoint: "http://product-a-mcp:3101/mcp", allowedHosts: ["product-a-mcp:3101"],
    localDemoHttp: true, authentication: "current-user", approvals },
], null, 2));
console.log("Platform artifacts ready. Product A and MCP are built and deployed independently.");
