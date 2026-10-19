import { lstat, readdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

/** 扫描安装目录：根目录单插件或子目录内各含 `plugin.json` 的包。 */
export async function discoverPluginPaths(installDir: string): Promise<string[]> {
  const approvedRoot = await realpath(installDir);
  if (await fileExists(resolve(approvedRoot, "plugin.json"))) return [approvedRoot];
  const entries = await readdir(approvedRoot, { withFileTypes: true });
  const pluginPaths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = resolve(approvedRoot, entry.name);
    if (await fileExists(resolve(candidate, "plugin.json"))) pluginPaths.push(candidate);
  }
  return pluginPaths.sort();
}
