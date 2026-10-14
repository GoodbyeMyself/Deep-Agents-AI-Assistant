import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
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
  } else {
    child.kill("SIGKILL");
  }
}

export default async function setup() {
  const agentServer = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve(repositoryRoot, "apps/agent-server/node_modules/tsx/dist/loader.mjs"))
        .href,
      resolve(repositoryRoot, "apps/agent-server/src/m3-demo-server-main.ts"),
    ],
    { cwd: repositoryRoot, windowsHide: true, stdio: "ignore" },
  );
  const webServer = spawn(
    process.execPath,
    [resolve(appRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"],
    { cwd: appRoot, windowsHide: true, stdio: "ignore" },
  );
  try {
    await Promise.all([
      waitFor("http://127.0.0.1:3000/api/v1/openapi.json"),
      waitFor("http://127.0.0.1:5173"),
    ]);
  } catch (error) {
    terminate(agentServer);
    terminate(webServer);
    throw error;
  }
  return () => {
    terminate(agentServer);
    terminate(webServer);
  };
}
