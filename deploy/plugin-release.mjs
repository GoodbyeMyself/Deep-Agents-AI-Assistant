import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../templates/plugin-bundle-v2",
);

function isInside(root, target) {
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256(path) {
  return `sha256-${createHash("sha256").update(await readFile(path)).digest("base64")}`;
}

function assertManifestShape(manifest) {
  if (
    manifest?.manifestVersion !== "2" ||
    manifest.apiVersion !== "2" ||
    typeof manifest.id !== "string" ||
    typeof manifest.version !== "string" ||
    typeof manifest.namespace !== "string" ||
    manifest.runtime?.type !== "local" ||
    typeof manifest.runtime.entry !== "string" ||
    !Array.isArray(manifest.capabilities)
  ) {
    throw new Error("Release tooling only accepts a local Manifest V2 plugin bundle.");
  }
}

async function resolveEntry(bundleRoot, manifest) {
  if (!manifest.runtime.entry.startsWith("./") || isAbsolute(manifest.runtime.entry)) {
    throw new Error("Plugin entry must be a relative path inside the bundle.");
  }
  const root = await realpath(bundleRoot);
  const unresolved = resolve(root, manifest.runtime.entry);
  const entry = await realpath(unresolved);
  if (!isInside(root, entry) || !(await lstat(entry)).isFile()) {
    throw new Error("Plugin entry escapes the bundle or is not a file.");
  }
  let current = root;
  for (const segment of relative(root, unresolved).split(/[\\/]/u)) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink()) {
      throw new Error("Plugin entry cannot contain symbolic-link path segments.");
    }
  }
  return entry;
}

export async function inspectPluginBundle(bundleDir, options = {}) {
  const bundleRoot = resolve(bundleDir);
  const manifestPath = resolve(bundleRoot, "plugin.json");
  const manifest = await readJson(manifestPath);
  assertManifestShape(manifest);
  const entryPath = await resolveEntry(bundleRoot, manifest);
  const artifactHash = await sha256(entryPath);
  if (options.requireIntegrity !== false && manifest.integrity !== artifactHash) {
    throw new Error("Plugin entry hash does not match plugin.json integrity.");
  }
  const metadataPath = resolve(bundleRoot, "plugin-release.json");
  const metadata = (await exists(metadataPath))
    ? await readJson(metadataPath)
    : { formatVersion: 1, configVersion: 1, compatibleConfigVersions: [1], breaking: false };
  if (
    metadata.formatVersion !== 1 ||
    !Number.isInteger(metadata.configVersion) ||
    !Array.isArray(metadata.compatibleConfigVersions) ||
    !metadata.compatibleConfigVersions.every(Number.isInteger)
  ) {
    throw new Error("plugin-release.json is invalid.");
  }
  return { artifactHash, bundleRoot, entryPath, manifest, metadata };
}

export async function stampPluginBundle(bundleDir) {
  const stamped = await stampLocalPluginIntegrity(bundleDir);
  assertManifestShape(stamped.manifest);
  return stamped;
}

export async function stampLocalPluginIntegrity(bundleDir) {
  const bundleRoot = resolve(bundleDir);
  const manifestPath = resolve(bundleRoot, "plugin.json");
  const manifest = await readJson(manifestPath);
  if (
    !["1", "2"].includes(manifest?.manifestVersion) ||
    typeof manifest.id !== "string" ||
    typeof manifest.version !== "string" ||
    manifest.runtime?.type !== "local" ||
    typeof manifest.runtime.entry !== "string"
  ) {
    throw new Error("Integrity stamping requires a local Manifest V1 or V2 plugin bundle.");
  }
  const entryPath = await resolveEntry(bundleRoot, manifest);
  const artifactHash = await sha256(entryPath);
  const nextManifest = { ...manifest, integrity: artifactHash };
  await writeJson(manifestPath, nextManifest);
  if (manifest.manifestVersion === "1") {
    return { artifactHash, bundleRoot, entryPath, manifest: nextManifest };
  }
  const inspected = await inspectPluginBundle(bundleDir, { requireIntegrity: false });
  return { ...inspected, artifactHash, manifest: nextManifest };
}

export async function verifyPluginApproval(bundleDir, approval) {
  const inspected = await inspectPluginBundle(bundleDir);
  const { manifest, metadata, artifactHash } = inspected;
  if (
    approval?.pluginId !== manifest.id ||
    approval.namespace !== manifest.namespace ||
    approval.artifactHash !== artifactHash
  ) {
    throw new Error("Plugin identity, namespace, or artifact hash is not approved.");
  }
  const approvedPermissions = new Set(approval.permissions ?? []);
  for (const capability of manifest.capabilities) {
    if (!approvedPermissions.has(capability.requiredPermission)) {
      throw new Error(`Permission '${capability.requiredPermission}' is not approved.`);
    }
  }
  if (!metadata.compatibleConfigVersions.includes(approval.configVersion)) {
    throw new Error(
      `Config version ${String(approval.configVersion)} is not compatible with this release.`,
    );
  }
  return inspected;
}

function capabilityKeys(manifest) {
  return new Set(
    manifest.capabilities.map(
      (capability) => `${capability.id}@${capability.contractVersion}`,
    ),
  );
}

function assertUpgradeCompatible(previous, next, approval) {
  if (previous.manifest.namespace !== next.manifest.namespace) {
    throw new Error("Upgrade cannot change the approved plugin namespace.");
  }
  const nextKeys = capabilityKeys(next.manifest);
  const removed = [...capabilityKeys(previous.manifest)].filter((key) => !nextKeys.has(key));
  if (
    removed.length > 0 &&
    !(next.metadata.breaking === true && approval.allowBreakingUpgrade === true)
  ) {
    throw new Error(`Upgrade removes contracts without approval: ${removed.join(", ")}`);
  }
}

function deploymentPaths(deploymentDir, pluginId) {
  const root = resolve(deploymentDir);
  return {
    root,
    activeRoot: resolve(root, "active"),
    active: resolve(root, "active", pluginId),
    releasesRoot: resolve(root, "releases", pluginId),
    stateRoot: resolve(root, "state"),
    state: resolve(root, "state", `${pluginId}.json`),
  };
}

async function readState(paths) {
  return (await exists(paths.state)) ? await readJson(paths.state) : undefined;
}

async function activateRelease(paths, releasePath) {
  const incoming = resolve(paths.activeRoot, `.${basename(paths.active)}-incoming-${randomUUID()}`);
  const outgoing = resolve(paths.activeRoot, `.${basename(paths.active)}-outgoing-${randomUUID()}`);
  await cp(releasePath, incoming, { recursive: true });
  let movedCurrent = false;
  try {
    if (await exists(paths.active)) {
      await rename(paths.active, outgoing);
      movedCurrent = true;
    }
    await rename(incoming, paths.active);
  } catch (error) {
    if (movedCurrent && !(await exists(paths.active))) await rename(outgoing, paths.active);
    await rm(incoming, { recursive: true, force: true });
    throw error;
  }
  if (movedCurrent) await rm(outgoing, { recursive: true, force: true });
}

export async function installPluginRelease({ bundleDir, deploymentDir, approval }) {
  const inspected = await verifyPluginApproval(bundleDir, approval);
  const paths = deploymentPaths(deploymentDir, inspected.manifest.id);
  await mkdir(paths.activeRoot, { recursive: true });
  await mkdir(paths.releasesRoot, { recursive: true });
  await mkdir(paths.stateRoot, { recursive: true });
  const previousState = await readState(paths);
  let previous;
  if (previousState?.current?.releasePath) {
    previous = await inspectPluginBundle(previousState.current.releasePath);
    assertUpgradeCompatible(previous, inspected, approval);
  }

  const hashToken = inspected.artifactHash
    .slice(7)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
    .slice(0, 12);
  const releaseName = `${inspected.manifest.version}-${hashToken}`;
  const releasePath = resolve(paths.releasesRoot, releaseName);
  if (!(await exists(releasePath))) {
    const staging = resolve(paths.releasesRoot, `.staging-${randomUUID()}`);
    await cp(inspected.bundleRoot, staging, { recursive: true });
    await inspectPluginBundle(staging);
    await rename(staging, releasePath);
  }
  await activateRelease(paths, releasePath);

  const current = {
    version: inspected.manifest.version,
    artifactHash: inspected.artifactHash,
    releasePath,
    configVersion: approval.configVersion,
  };
  const history = [
    ...(previousState?.history ?? []),
    ...(previousState?.current ? [previousState.current] : []),
  ].filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.releasePath === item.releasePath) === index,
  );
  const state = {
    pluginId: inspected.manifest.id,
    status: "active",
    current,
    previous: previousState?.current,
    history,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(paths.state, state);
  return state;
}

export async function disablePluginRelease(deploymentDir, pluginId) {
  const paths = deploymentPaths(deploymentDir, pluginId);
  const state = await readState(paths);
  if (!state?.current) throw new Error(`Plugin '${pluginId}' is not installed.`);
  if (await exists(paths.active)) await rm(paths.active, { recursive: true, force: true });
  const next = { ...state, status: "disabled", updatedAt: new Date().toISOString() };
  await writeJson(paths.state, next);
  return next;
}

export async function rollbackPluginRelease(deploymentDir, pluginId) {
  const paths = deploymentPaths(deploymentDir, pluginId);
  const state = await readState(paths);
  if (!state?.previous) throw new Error(`Plugin '${pluginId}' has no previous release.`);
  await inspectPluginBundle(state.previous.releasePath);
  await activateRelease(paths, state.previous.releasePath);
  const remainingHistory = (state.history ?? []).filter(
    (item) => item.releasePath !== state.previous.releasePath,
  );
  const next = {
    ...state,
    status: "active",
    current: state.previous,
    previous: remainingHistory.at(-1),
    history: remainingHistory,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(paths.state, next);
  return next;
}

export async function diagnosePluginRelease(deploymentDir, pluginId) {
  const paths = deploymentPaths(deploymentDir, pluginId);
  const state = await readState(paths);
  if (!state) return { pluginId, status: "not-installed", active: false };
  const active = await exists(paths.active);
  let verification = "not-active";
  if (active) {
    try {
      await inspectPluginBundle(paths.active);
      verification = "verified";
    } catch {
      verification = "invalid";
    }
  }
  return { ...state, active, verification };
}

async function replaceTokens(root, replacements) {
  const entries = await import("node:fs/promises").then(({ readdir }) =>
    readdir(root, { withFileTypes: true }),
  );
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await replaceTokens(path, replacements);
    else {
      let content = await readFile(path, "utf8");
      for (const [token, value] of Object.entries(replacements)) {
        content = content.replaceAll(token, value);
      }
      await writeFile(path, content, "utf8");
    }
    let nextName = entry.name;
    for (const [token, value] of Object.entries(replacements)) {
      nextName = nextName.replaceAll(token, value);
    }
    if (nextName !== entry.name) await rename(path, join(root, nextName));
  }
}

export async function scaffoldPluginBundle({ targetDir, pluginId, namespace }) {
  const target = resolve(targetDir);
  if (await exists(target)) throw new Error(`Target already exists: ${target}`);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(pluginId)) {
    throw new Error("pluginId must be a lowercase kebab-case identifier.");
  }
  if (!/^[a-z][a-z0-9_]*$/u.test(namespace)) {
    throw new Error("namespace must be a lowercase identifier.");
  }
  await cp(templateRoot, target, { recursive: true });
  await replaceTokens(target, {
    __PLUGIN_ID__: pluginId,
    __NAMESPACE__: namespace,
    __SKILL_NAME__: `${pluginId}-lookup`,
  });
  return target;
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) return;
  if (command === "hash") {
    console.log(JSON.stringify(await stampPluginBundle(args[0]), null, 2));
  } else if (command === "verify") {
    console.log(
      JSON.stringify(await verifyPluginApproval(args[0], await readJson(resolve(args[1]))), null, 2),
    );
  } else if (command === "install") {
    console.log(
      JSON.stringify(
        await installPluginRelease({
          bundleDir: args[0],
          deploymentDir: args[1],
          approval: await readJson(resolve(args[2])),
        }),
        null,
        2,
      ),
    );
  } else if (command === "disable") {
    console.log(JSON.stringify(await disablePluginRelease(args[0], args[1]), null, 2));
  } else if (command === "rollback") {
    console.log(JSON.stringify(await rollbackPluginRelease(args[0], args[1]), null, 2));
  } else if (command === "diagnose") {
    console.log(JSON.stringify(await diagnosePluginRelease(args[0], args[1]), null, 2));
  } else if (command === "scaffold") {
    console.log(
      await scaffoldPluginBundle({ targetDir: args[0], pluginId: args[1], namespace: args[2] }),
    );
  } else {
    throw new Error(`Unknown command '${command}'.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
