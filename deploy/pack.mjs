import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  lstatSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { stampLocalPluginIntegrity } from "./plugin-release.mjs";

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
  if (result.error !== undefined) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readPlugin(adapterDir) {
  const manifestPath = resolve(adapterDir, "plugin.json");
  const packagePath = resolve(adapterDir, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`${adapterDir} has plugin.json but is not a workspace package.`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest.id !== "string" || manifest.id.length === 0) {
    throw new Error(`${manifestPath} is missing a plugin id.`);
  }
  return { id: manifest.id, directory: adapterDir, manifestPath };
}

function discoverAdapters() {
  const adaptersRoot = resolve(repoRoot, "adapters");
  const plugins = [];
  for (const entry of readdirSync(adaptersRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const adapterDir = resolve(adaptersRoot, entry.name);
    if (!existsSync(resolve(adapterDir, "plugin.json"))) continue;
    plugins.push(readPlugin(adapterDir));
  }
  plugins.sort((left, right) => left.id.localeCompare(right.id));
  const seen = new Set();
  for (const plugin of plugins) {
    if (seen.has(plugin.id)) throw new Error(`Duplicate plugin id '${plugin.id}'.`);
    seen.add(plugin.id);
  }
  if (plugins.length === 0) throw new Error("No adapters with plugin.json were found.");
  return plugins;
}

function isInside(rootReal, targetReal) {
  const relativePath = relative(rootReal, targetReal);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function deployedPackageRoot(link, bundleReal) {
  let current = dirname(link);
  while (isInside(bundleReal, current)) {
    if (
      existsSync(resolve(current, "package.json")) &&
      existsSync(resolve(current, "node_modules"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Cannot retarget symlink '${link}' inside the deploy bundle.`);
}

function collectSymlinks(rootReal) {
  const links = [];
  const pending = [rootReal];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = resolve(current, entry.name);
      if (entry.isSymbolicLink()) links.push(full);
      else if (entry.isDirectory()) pending.push(full);
    }
  }
  return links;
}

function relativizeSymlinks(root) {
  const rootReal = realpathSync(root);
  for (const link of collectSymlinks(rootReal)) {
    let currentTarget;
    try {
      currentTarget = realpathSync(link);
    } catch {
      unlinkSync(link);
      continue;
    }
    const target = isInside(rootReal, currentTarget)
      ? currentTarget
      : deployedPackageRoot(link, rootReal);
    const linkTarget = relative(dirname(link), target).replaceAll("\\", "/");
    unlinkSync(link);
    symlinkSync(linkTarget, link, lstatSync(target).isDirectory() ? "dir" : "file");
  }
}

function assertBundleContained(root) {
  const rootReal = realpathSync(root);
  const visited = new Set();
  const pending = [rootReal];
  while (pending.length > 0) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = resolve(current, entry.name);
      const stat = lstatSync(full);
      if (!stat.isSymbolicLink() && !stat.isDirectory()) continue;
      const real = realpathSync(full);
      if (!isInside(rootReal, real)) {
        throw new Error(`Deploy bundle escapes the output directory: ${full} -> ${real}`);
      }
      if (stat.isDirectory() || lstatSync(real).isDirectory()) pending.push(real);
    }
  }
}

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Deploy bundle is missing ${path}.`);
}

async function verifyBundle(plugins) {
  const server = await import(
    pathToFileURL(resolve(stagingDir, "server/dist/application/bootstrap.js")).href
  );
  if (typeof server.createAgentApplication !== "function") {
    throw new Error("Deployed Agent Server did not load.");
  }
  for (const plugin of plugins) {
    const imported = await import(
      pathToFileURL(resolve(stagingDir, "plugins", plugin.id, "dist/index.js")).href
    );
    if (typeof imported.default !== "function") {
      throw new Error(`Plugin '${plugin.id}' does not export a factory.`);
    }
  }
}

const plugins = discoverAdapters();
const filters = [
  "@assistant/agent-server...",
  "@assistant/assistant-web...",
  "@assistant/assistant-embed...",
  ...plugins.map((plugin) => `./${relative(repoRoot, plugin.directory).replaceAll("\\", "/")}...`),
];
run(filters.flatMap((filter) => ["--filter", filter]).concat("build"));

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(resolve(stagingDir, "plugins"), { recursive: true });
run([
  "--filter",
  "@assistant/agent-server",
  "--prod",
  "--legacy",
  "deploy",
  resolve(stagingDir, "server"),
]);
for (const plugin of plugins) {
  const target = resolve(stagingDir, "plugins", plugin.id);
  run([
    "--filter",
    `./${relative(repoRoot, plugin.directory).replaceAll("\\", "/")}`,
    "--prod",
    "--legacy",
    "deploy",
    target,
  ]);
  if (!existsSync(resolve(target, "plugin.json"))) {
    cpSync(plugin.manifestPath, resolve(target, "plugin.json"));
  }
  requireFile(resolve(target, "dist/index.js"));
  requireFile(resolve(target, "plugin.json"));
  await stampLocalPluginIntegrity(target);
}

cpSync(resolve(repoRoot, "apps/assistant-web/dist"), resolve(stagingDir, "web"), {
  recursive: true,
});
cpSync(resolve(repoRoot, "apps/assistant-embed/dist"), resolve(stagingDir, "embed"), {
  recursive: true,
});
requireFile(resolve(stagingDir, "server/dist/server-main.js"));
requireFile(resolve(stagingDir, "web/index.html"));
requireFile(resolve(stagingDir, "embed/index.html"));
requireFile(resolve(stagingDir, "embed/assistant-loader.js"));
relativizeSymlinks(stagingDir);
assertBundleContained(stagingDir);
await verifyBundle(plugins);

writeFileSync(
  resolve(stagingDir, "release.json"),
  `${JSON.stringify(
    {
      packedAt: new Date().toISOString(),
      services: ["server", "web", "embed"],
      plugins: plugins.map((plugin) => plugin.id),
    },
    null,
    2,
  )}\n`,
);

rmSync(outDir, { recursive: true, force: true });
renameSync(stagingDir, outDir);
console.log(`Deploy bundle ready at ${outDir}`);
console.log(`Plugins: ${plugins.map((plugin) => plugin.id).join(", ")}`);
