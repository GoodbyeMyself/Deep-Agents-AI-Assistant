// This entrypoint runs pnpm and MUST be invoked by the user, never by Codex.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mcpRoot = resolve(process.env.MCP_REPO_PATH ?? resolve(root, "../Deep-Agents-AI-Assistant-MCP"));
const demoRoot = resolve(process.env.DEMO_REPO_PATH ?? resolve(root, "../Deep-Agents-AI-Assistant-Demo"));
for (const directory of [mcpRoot, demoRoot]) {
  if (!existsSync(resolve(directory, "package.json"))) throw new Error(`Required repository is missing: ${directory}`);
}
function run(cwd, args, environment = process.env) {
  const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args,
    { cwd, stdio: "inherit", shell: process.platform === "win32", env: environment });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(root, ["pack:deploy"], { ...process.env,
  VITE_ASSISTANT_WEB_URL: process.env.VITE_ASSISTANT_WEB_URL ?? "http://127.0.0.1:8080/assistant" });
run(mcpRoot, ["pack:product-a"]);
run(demoRoot, ["--filter", "@assistant/demo-product-a-web", "build"]);
cpSync(resolve(mcpRoot, "deploy/out/product-a-mcp"), resolve(root, "deploy/out/product-a-mcp"), { recursive: true });
cpSync(resolve(demoRoot, "product-a/dist"), resolve(root, "deploy/out/product-a-demo"), { recursive: true });
// Explicit local composition approvals: fixed reviewed Tool digests, never auto-approved discovery.
const approvals = [
  ["get_quality_trend", "1e186399a946e06fc251f535634a99d0321b409c8c2eb190b97e3a397745812e"],
  ["list_table_sample_rows", "03f9da7b21f7b939067086a0a4ce73fd4616a8775adab5521a1a4d01a5b8ec02"],
  ["get_table_metadata", "2d2e31afa7ad70790db3d6be316135f46929f2cba0e16e1d06ebec2d41cf17ab"],
  ["search_data_assets", "2036488ae65f79f663b176ba9c77c6534169df8d24b6e17b5f8f5a008b0fb761"],
].map(([toolName, schemaDigest]) => ({ toolName, schemaDigest, riskLevel: "read" }));
writeFileSync(resolve(root, "deploy/out/local-mcp-approval.json"), JSON.stringify([
  { serverId: "product-a-mcp", endpoint: "http://product-a-mcp:3101/mcp", allowedHosts: ["product-a-mcp:3101"],
    localDemoHttp: true, approvals },
], null, 2));
console.log("Local six-service Docker artifacts ready. No credentials are embedded in images.");
