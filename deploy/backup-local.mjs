import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backups = resolve(root, "deploy/backups");
mkdirSync(backups, { recursive: true });
const filename = resolve(backups, `assistant-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.sql`);
const temporary = `${filename}.partial`;
const child = spawn("docker", ["compose", "--project-name", "assistant-agents", "--env-file", "deploy/.env.local", "-f", "deploy/docker-compose.postgres.yml",
  "exec", "-T", "postgres", "pg_dump", "-U", "assistant", "-d", "assistant", "--no-owner", "--no-privileges"],
{ cwd: root, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
const completion = new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("close", (code) => code === 0 ? resolveExit() : reject(new Error("Database backup failed.")));
});
try {
  await Promise.all([pipeline(child.stdout, createWriteStream(temporary, { flags: "wx" })), completion]);
  renameSync(temporary, filename);
  console.log(`Backup saved: ${filename}. Treat it as sensitive data.`);
} catch (error) {
  child.kill();
  if (existsSync(temporary)) unlinkSync(temporary);
  throw error;
}
