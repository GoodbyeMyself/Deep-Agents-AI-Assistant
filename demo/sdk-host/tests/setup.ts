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
      /* starting */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function terminate(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else child.kill("SIGKILL");
}

function startVite(cwd: string): void {
  children.push(
    spawn(
      process.execPath,
      [resolve(cwd, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"],
      { cwd, windowsHide: true, stdio: "ignore" },
    ),
  );
}

export default async function setup() {
  children.push(
    spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(resolve(repositoryRoot, "demo/server/node_modules/tsx/dist/loader.mjs")).href,
        resolve(repositoryRoot, "demo/server/src/m4-demo-server-main.ts"),
      ],
      {
        cwd: repositoryRoot,
        env: { ...process.env, SERVER_PORT: "3310" },
        windowsHide: true,
        stdio: "ignore",
      },
    ),
  );
  startVite(resolve(repositoryRoot, "apps/assistant-embed"));
  startVite(appRoot);
  try {
    await Promise.all([
      waitFor("http://127.0.0.1:3310/api/v1/openapi.json"),
      waitFor("http://127.0.0.1:5314"),
      waitFor("http://127.0.0.1:5315"),
    ]);
  } catch (error) {
    children.forEach(terminate);
    throw error;
  }
  return () => children.forEach(terminate);
}
