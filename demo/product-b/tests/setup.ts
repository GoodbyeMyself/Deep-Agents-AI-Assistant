import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const children: ChildProcess[] = [];

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function terminate(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGKILL");
}

export default async function setup() {
  children.push(
    spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(resolve(repositoryRoot, "demo/server/node_modules/tsx/dist/loader.mjs")).href,
        resolve(repositoryRoot, "demo/server/src/demo-product-b-e2e-server-main.ts"),
      ],
      {
        cwd: repositoryRoot,
        windowsHide: true,
        stdio: "ignore",
      },
    ),
    spawn(
      process.execPath,
      [resolve(appRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"],
      { cwd: appRoot, windowsHide: true, stdio: "ignore" },
    ),
    spawn(
      process.execPath,
      [
        resolve(repositoryRoot, "apps/assistant-embed/node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
      ],
      {
        cwd: resolve(repositoryRoot, "apps/assistant-embed"),
        env: {
          ...process.env,
          ASSISTANT_EMBED_PORT: "5512",
          ASSISTANT_API_TARGET: "http://127.0.0.1:3412",
          ASSISTANT_HOST_ORIGIN: "http://127.0.0.1:5412",
        },
        windowsHide: true,
        stdio: "ignore",
      },
    ),
  );
  try {
    await Promise.all([
      waitFor("http://127.0.0.1:3412/api/v1/openapi.json"),
      waitFor("http://127.0.0.1:5412"),
      waitFor("http://127.0.0.1:5512"),
    ]);
  } catch (error) {
    children.forEach(terminate);
    throw error;
  }
  return () => children.forEach(terminate);
}
