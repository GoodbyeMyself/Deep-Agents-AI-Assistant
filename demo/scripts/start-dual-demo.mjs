import { spawn, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const commands = [
  {
    name: "Product A Agent Server",
    args: [
      "demo/server/node_modules/tsx/dist/cli.mjs",
      "demo/server/src/demo-product-a-server-main.ts",
    ],
  },
  {
    name: "Product A Web",
    args: ["demo/product-a/node_modules/vite/bin/vite.js", "demo/product-a", "--host", "127.0.0.1"],
  },
  {
    name: "Product A iframe Assistant",
    args: [
      "apps/assistant-embed/node_modules/vite/bin/vite.js",
      "apps/assistant-embed",
      "--host",
      "127.0.0.1",
    ],
    env: {
      ASSISTANT_EMBED_PORT: "5511",
      ASSISTANT_API_TARGET: "http://127.0.0.1:3411",
      ASSISTANT_HOST_ORIGIN: "http://127.0.0.1:5411",
    },
  },
  {
    name: "Product B Agent Server",
    args: [
      "demo/server/node_modules/tsx/dist/cli.mjs",
      "demo/server/src/demo-product-b-server-main.ts",
    ],
  },
  {
    name: "Product B Web",
    args: ["demo/product-b/node_modules/vite/bin/vite.js", "demo/product-b", "--host", "127.0.0.1"],
  },
  {
    name: "Product B iframe Assistant",
    args: [
      "apps/assistant-embed/node_modules/vite/bin/vite.js",
      "apps/assistant-embed",
      "--host",
      "127.0.0.1",
    ],
    env: {
      ASSISTANT_EMBED_PORT: "5512",
      ASSISTANT_API_TARGET: "http://127.0.0.1:3412",
      ASSISTANT_HOST_ORIGIN: "http://127.0.0.1:5412",
    },
  },
];
const childRunner = fileURLToPath(new URL("./run-demo-child.mjs", import.meta.url));
const launcherParentPid = process.ppid;
const heartbeatPath = join(tmpdir(), `assistant-dual-demo-${process.pid}.heartbeat`);
writeFileSync(heartbeatPath, new Date().toISOString(), "utf8");
const heartbeat = setInterval(
  () => writeFileSync(heartbeatPath, new Date().toISOString(), "utf8"),
  500,
);

const children = commands.map(({ name, args: commandArgs, env }) => {
  const child = spawn(
    process.execPath,
    [childRunner, String(process.pid), heartbeatPath, ...commandArgs],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  child.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`${name} exited with code ${code}.`);
  });
  return child;
});

let parentMonitor;
function terminate() {
  if (parentMonitor !== undefined) clearInterval(parentMonitor);
  clearInterval(heartbeat);
  rmSync(heartbeatPath, { force: true });
  for (const child of children) {
    if (child.pid === undefined) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

parentMonitor = setInterval(() => {
  try {
    process.kill(launcherParentPid, 0);
  } catch {
    terminate();
    process.exit(0);
  }
}, 500);

process.once("SIGINT", () => {
  terminate();
  process.exit(0);
});
process.once("SIGTERM", () => {
  terminate();
  process.exit(0);
});
process.once("exit", terminate);

console.log("\n双产品演示正在启动：");
console.log("  Product A  http://127.0.0.1:5411");
console.log("  Product B  http://127.0.0.1:5412");
console.log("  A iframe   http://127.0.0.1:5511");
console.log("  B iframe   http://127.0.0.1:5512");
console.log("按 Ctrl+C 停止全部演示进程。\n");

setInterval(() => undefined, 60_000);
