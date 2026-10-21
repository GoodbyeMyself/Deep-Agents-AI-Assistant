import { spawn, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { openBrowser } from "./open-browser.mjs";
import { waitForPort } from "./wait-for-port.mjs";

/** @type {const} */
export const DEMO_PORTS = {
  aServer: 3411,
  aWeb: 5411,
  aEmbed: 5511,
  bServer: 3412,
  bWeb: 5412,
  bEmbed: 5512,
  standaloneServer: 3410,
  standaloneWeb: 5173,
};

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
      ASSISTANT_EMBED_PORT: String(DEMO_PORTS.aEmbed),
      ASSISTANT_API_TARGET: `http://127.0.0.1:${DEMO_PORTS.aServer}`,
      ASSISTANT_HOST_ORIGIN: `http://127.0.0.1:${DEMO_PORTS.aWeb}`,
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
      ASSISTANT_EMBED_PORT: String(DEMO_PORTS.bEmbed),
      ASSISTANT_API_TARGET: `http://127.0.0.1:${DEMO_PORTS.bServer}`,
      ASSISTANT_HOST_ORIGIN: `http://127.0.0.1:${DEMO_PORTS.bWeb}`,
    },
  },
  {
    name: "Standalone Agent Server",
    args: [
      "demo/server/node_modules/tsx/dist/cli.mjs",
      "demo/server/src/demo-product-a-server-main.ts",
    ],
    env: {
      SERVER_PORT: String(DEMO_PORTS.standaloneServer),
    },
  },
  {
    name: "Standalone Web Assistant",
    args: [
      "apps/assistant-web/node_modules/vite/bin/vite.js",
      "apps/assistant-web",
      "--host",
      "127.0.0.1",
    ],
    env: {
      ASSISTANT_API_TARGET: `http://127.0.0.1:${DEMO_PORTS.standaloneServer}`,
      ASSISTANT_WEB_PORT: String(DEMO_PORTS.standaloneWeb),
    },
  },
];

const browserTargets = [
  { label: "Product A（含嵌入式助手）", url: `http://127.0.0.1:${DEMO_PORTS.aWeb}` },
  { label: "Product B（含嵌入式助手）", url: `http://127.0.0.1:${DEMO_PORTS.bWeb}` },
  { label: "独立 Web 助手", url: `http://127.0.0.1:${DEMO_PORTS.standaloneWeb}/assistant` },
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

console.log("\n双产品 + 独立 Web 演示正在启动：");
console.log(`  Product A       http://127.0.0.1:${DEMO_PORTS.aWeb}`);
console.log(`  Product B       http://127.0.0.1:${DEMO_PORTS.bWeb}`);
console.log(`  独立 Web 助手   http://127.0.0.1:${DEMO_PORTS.standaloneWeb}/assistant`);
console.log(`  A iframe 助手   http://127.0.0.1:${DEMO_PORTS.aEmbed}（由 A 页面嵌入）`);
console.log(`  B iframe 助手   http://127.0.0.1:${DEMO_PORTS.bEmbed}（由 B 页面嵌入）`);
console.log("按 Ctrl+C 停止全部演示进程。");
if (process.env["DEMO_OPEN_BROWSER"] === "0") {
  console.log("已设置 DEMO_OPEN_BROWSER=0，不会自动打开浏览器。\n");
} else {
  console.log("端口就绪后将自动打开 Product A、Product B 与独立 Web 助手。\n");
}

void (async () => {
  const ports = [
    DEMO_PORTS.aServer,
    DEMO_PORTS.aWeb,
    DEMO_PORTS.aEmbed,
    DEMO_PORTS.bServer,
    DEMO_PORTS.bWeb,
    DEMO_PORTS.bEmbed,
    DEMO_PORTS.standaloneServer,
    DEMO_PORTS.standaloneWeb,
  ];
  try {
    await Promise.all(ports.map((port) => waitForPort(port)));
    for (const target of browserTargets) {
      openBrowser(target.url);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    console.log("已在浏览器中打开演示入口。");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`未能自动打开浏览器（${message}）。请手动访问上述地址。`);
  }
})();

setInterval(() => undefined, 60_000);
