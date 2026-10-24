import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

/** Read only Git metadata; source archives without .git remain buildable. */
export function createBuildInfo() {
  const git = (...args) => {
    try {
      return execFileSync("git", args, {
        cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000, windowsHide: true,
      }).trim();
    } catch { return undefined; }
  };
  const commit = git("rev-parse", "HEAD");
  const branch = git("symbolic-ref", "--quiet", "--short", "HEAD");
  const changes = git("status", "--porcelain", "--untracked-files=normal");
  return {
    builtAt: new Date().toISOString(),
    branch: branch || (commit ? "detached HEAD" : "unknown"),
    commit: commit || "unknown",
    dirty: changes === undefined ? "unknown" : changes.length > 0,
  };
}
