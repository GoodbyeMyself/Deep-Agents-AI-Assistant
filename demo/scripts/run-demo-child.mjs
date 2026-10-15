import { spawn, spawnSync } from "node:child_process";
import { statSync } from "node:fs";

const parentPid = Number(process.argv[2]);
const heartbeatPath = process.argv[3];
const commandArgs = process.argv.slice(4);
if (!Number.isInteger(parentPid) || parentPid < 1 || !heartbeatPath || commandArgs.length === 0) {
  throw new Error(
    "run-demo-child requires a parent PID, heartbeat path, and Node command arguments.",
  );
}

const child = spawn(process.execPath, commandArgs, {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
function terminate() {
  if (stopping || child.pid === undefined) return;
  stopping = true;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

const parentCheck = setInterval(() => {
  try {
    process.kill(parentPid, 0);
    if (Date.now() - statSync(heartbeatPath).mtimeMs <= 2_000) return;
  } catch {
    // Missing parent or stale heartbeat both require recursive child cleanup.
  }
  terminate();
  process.exit(0);
}, 500);

child.once("exit", (code) => {
  clearInterval(parentCheck);
  process.exit(code ?? 0);
});
process.once("SIGINT", () => {
  terminate();
  process.exit(0);
});
process.once("SIGTERM", () => {
  terminate();
  process.exit(0);
});
process.once("exit", terminate);
