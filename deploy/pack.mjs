import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const stagingDir = resolve(repoRoot, "deploy/.pack-tmp");
const outDir = resolve(repoRoot, "deploy/out");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  const result = spawnSync(pnpm, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Deploy bundle is missing ${path}.`);
}

run([
  "--filter", "@assistant/agent-server...",
  "--filter", "@assistant/assistant-web...",
  "--filter", "@assistant/assistant-embed...",
  "build",
]);

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });
run([
  "--filter", "@assistant/agent-server",
  "--prod", "--legacy", "deploy",
  resolve(stagingDir, "server"),
]);
cpSync(resolve(repoRoot, "apps/assistant-web/dist"), resolve(stagingDir, "web"), { recursive: true });
cpSync(resolve(repoRoot, "apps/assistant-embed/dist"), resolve(stagingDir, "embed"), { recursive: true });
requireFile(resolve(stagingDir, "server/dist/server-main.js"));
requireFile(resolve(stagingDir, "web/index.html"));
requireFile(resolve(stagingDir, "embed/index.html"));

const server = await import(
  pathToFileURL(resolve(stagingDir, "server/dist/application/bootstrap.js")).href
);
if (typeof server.createAgentApplication !== "function")
  throw new Error("Deployed Agent Server did not load.");

writeFileSync(
  resolve(stagingDir, "release.json"),
  `${JSON.stringify({
    packedAt: new Date().toISOString(),
    services: ["server", "web", "embed"],
    businessCapabilitySource: "external-mcp",
  }, null, 2)}\n`,
);
rmSync(outDir, { recursive: true, force: true });
renameSync(stagingDir, outDir);
console.log(`Platform deploy bundle ready at ${outDir}`);
