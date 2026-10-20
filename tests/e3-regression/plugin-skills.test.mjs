import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createSkillSnapshot } from "../../packages/agent-runtime/dist/index.js";
import {
  CapabilityCatalog,
  CapabilityExecutor,
  CapabilityRegistry,
} from "../../core/capability/dist/index.js";
import { PluginRuntime } from "../../packages/plugin-runtime/dist/index.js";
import { listSkills } from "../../packages/agent-runtime/node_modules/deepagents/dist/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const pluginSdkUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/dist/index.js"),
).href;
const zodUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/node_modules/zod/index.js"),
).href;
const temporaryRoots = [];

test.after(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

function moduleSource(capabilityId, healthFailure = false) {
  return `
import { defineCapability, definePlugin, implementCapability } from ${JSON.stringify(pluginSdkUrl)};
import { z } from ${JSON.stringify(zodUrl)};
const contract = defineCapability({
  id: ${JSON.stringify(capabilityId)}, version: "1.0.0", description: "Read metadata.",
  inputSchema: z.object({ objectId: z.string() }).strict(),
  dataSchema: z.object({ objectId: z.string() }),
  requiredPermission: "metadata:read", riskLevel: "read",
});
export default definePlugin(() => ({
  contracts: [contract],
  capabilities: [implementCapability({ contract, execute: (input) => Promise.resolve({
    status: "success", data: input,
    evidence: [{ id: "e3", source: { type: "service", id: "metadata" }, collectedAt: "2026-10-20T00:00:00+08:00", referenceId: "e3:" + input.objectId }], warnings: [],
  }) })],
  initialize: () => Promise.resolve(), healthCheck: () => Promise.resolve({ ok: ${healthFailure ? "false" : "true"} }),
}));`;
}

async function createBundle(options = {}) {
  const pluginId = options.pluginId ?? "metadata-query";
  const skillName = options.skillName ?? `${pluginId}-skill`;
  const capabilityId = `acme.${pluginId.replaceAll("-", "_")}.get`;
  const installRoot = options.installRoot ?? (await mkdtemp(join(tmpdir(), "assistant-e3-")));
  if (!options.installRoot) temporaryRoots.push(installRoot);
  const pluginRoot = join(installRoot, pluginId);
  await mkdir(join(pluginRoot, "dist"), { recursive: true });
  await mkdir(join(pluginRoot, "skills", skillName), { recursive: true });
  const requiredCapabilities = options.requiredCapabilities ?? [
    { id: capabilityId, contractVersion: "1.0.0" },
  ];
  const toolName = requiredCapabilities[0].id.replaceAll(/[^a-zA-Z0-9_]/g, "_");
  await writeFile(
    join(pluginRoot, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Query authorized metadata and cite server Evidence.\nallowed-tools: ${toolName}\n---\n\n# Workflow\nCall the Tool before factual claims.\n`,
    "utf8",
  );
  await writeFile(
    join(pluginRoot, "plugin.json"),
    JSON.stringify({
      manifestVersion: "2", id: pluginId, name: pluginId, version: "1.0.0", apiVersion: "2",
      namespace: "acme", runtime: { type: "local", entry: "./dist/index.mjs" },
      capabilities: [{ id: capabilityId, contractVersion: "1.0.0", contractSource: pluginId, requiredPermission: "metadata:read", riskLevel: "read" }],
      skills: [{ path: `./skills/${skillName}`, requiredCapabilities, ...(options.requiredConfig ? { requiredConfig: options.requiredConfig } : {}), ...(options.requiredCredentials ? { requiredCredentials: options.requiredCredentials } : {}) }],
    }),
    "utf8",
  );
  await writeFile(
    join(pluginRoot, "dist", "index.mjs"),
    moduleSource(capabilityId, options.healthFailure),
    "utf8",
  );
  return { capabilityId, installRoot, pluginId, skillName };
}

function createRuntime(bundle, options = {}) {
  const catalog = new CapabilityCatalog([]);
  const registry = new CapabilityRegistry();
  const runtime = new PluginRuntime({
    installDir: bundle.installRoot,
    approvedPluginIds: new Set(options.pluginIds ?? [bundle.pluginId]),
    approvedNamespaces: new Set(["acme"]),
    approvedPermissions: new Set(["metadata:read"]),
    catalog,
    capabilityRegistry: registry,
    ...(options.pluginConfigs ? { pluginConfigs: options.pluginConfigs } : {}),
    ...(options.hasCredential ? { hasCredential: options.hasCredential } : {}),
    ...(options.approvedSkillDependencies ? { approvedSkillDependencies: options.approvedSkillDependencies } : {}),
  });
  return { catalog, registry, runtime };
}

test("a bundle contributes a traceable Tool-associated Skill through the official format", async () => {
  const bundle = await createBundle();
  const { catalog, registry, runtime } = createRuntime(bundle);
  const [record] = await runtime.start();
  const [skill] = runtime.skillRegistry.list();

  assert.equal(record?.status, "ready");
  assert.equal(skill?.status, "available");
  assert.equal(skill?.pluginId, bundle.pluginId);
  assert.equal(skill?.pluginVersion, "1.0.0");
  assert.deepEqual(skill?.requiredToolNames, [bundle.capabilityId.replaceAll(".", "_")]);
  assert.match(skill?.artifactHash ?? "", /^sha256-/);

  const snapshot = await createSkillSnapshot(runtime.skillRegistry.list());
  temporaryRoots.push(snapshot.workspaceRoot);
  const officialSkills = listSkills({ projectSkillsDir: join(snapshot.workspaceRoot, "skills") });
  assert.deepEqual(officialSkills.map((item) => item.name), [bundle.skillName]);
  await writeFile(join(bundle.installRoot, bundle.pluginId, "skills", bundle.skillName, "SKILL.md"), "changed", "utf8");
  assert.match(
    await readFile(join(snapshot.workspaceRoot, "skills", bundle.skillName, "SKILL.md"), "utf8"),
    /Call the Tool/,
  );
  await assert.rejects(
    createSkillSnapshot(runtime.skillRegistry.list()),
    /changed after validation/,
  );

  const executor = new CapabilityExecutor({ catalog, registry });
  const denied = await executor.execute(
    bundle.capabilityId,
    "1.0.0",
    { objectId: "orders" },
    { executionContextId: "e3", contextSnapshotId: "snapshot", traceId: "trace", principalId: "user", permissionScopes: [] },
  );
  assert.equal(denied.error?.code, "FORBIDDEN");
});

test("missing Tool, config, or credential excludes the Skill without removing the Tool", async () => {
  const missingTool = await createBundle({
    requiredCapabilities: [{ id: "shared.metadata.get", contractVersion: "1.0.0" }],
  });
  const toolRuntime = createRuntime(missingTool, {
    approvedSkillDependencies: new Set([`${missingTool.pluginId}->shared.metadata.get@1.0.0`]),
  });
  const [toolRecord] = await toolRuntime.runtime.start();
  assert.equal(toolRecord?.skills?.[0]?.exclusionReason, "TOOL_UNAVAILABLE");
  assert.equal(toolRuntime.runtime.skillRegistry.list().length, 0);
  assert.ok(toolRuntime.registry.resolve(missingTool.capabilityId, "1.0.0"));

  const missingConfig = await createBundle({ requiredConfig: ["endpoint"] });
  const configRuntime = createRuntime(missingConfig);
  assert.equal((await configRuntime.runtime.start())[0]?.skills?.[0]?.exclusionReason, "CONFIG_UNAVAILABLE");

  const missingCredential = await createBundle({ requiredCredentials: ["api-token"] });
  const credentialRuntime = createRuntime(missingCredential, { hasCredential: async () => false });
  assert.equal((await credentialRuntime.runtime.start())[0]?.skills?.[0]?.exclusionReason, "CREDENTIAL_UNAVAILABLE");
});

test("an unhealthy plugin excludes its Skill and rolls back its Tool", async () => {
  const bundle = await createBundle({ healthFailure: true });
  const { registry, runtime } = createRuntime(bundle);
  const [record] = await runtime.start();
  assert.equal(record?.status, "degraded");
  assert.equal(record?.skills?.[0]?.exclusionReason, "PLUGIN_UNAVAILABLE");
  assert.equal(runtime.skillRegistry.list().length, 0);
  assert.equal(registry.list().length, 0);
});

test("duplicate Skill names are denied and the conflicting bundle registrations roll back", async () => {
  const installRoot = await mkdtemp(join(tmpdir(), "assistant-e3-conflict-"));
  temporaryRoots.push(installRoot);
  const first = await createBundle({ installRoot, pluginId: "first-plugin", skillName: "shared-skill" });
  const second = await createBundle({ installRoot, pluginId: "second-plugin", skillName: "shared-skill" });
  const { catalog, registry, runtime } = createRuntime(first, { pluginIds: [first.pluginId, second.pluginId] });
  const records = await runtime.start();

  assert.equal(records.filter((record) => record.status === "ready").length, 1);
  assert.equal(records.filter((record) => record.errorCode === "SKILL_NAME_CONFLICT").length, 1);
  assert.equal(runtime.skillRegistry.list().length, 1);
  assert.equal(registry.list().length, 1);
  assert.equal(catalog.list().length, 1);
});

test("Skill metadata cannot recommend Tools outside its manifest association", async () => {
  const bundle = await createBundle();
  await writeFile(
    join(bundle.installRoot, bundle.pluginId, "skills", bundle.skillName, "SKILL.md"),
    `---\nname: ${bundle.skillName}\ndescription: Invalid undeclared Tool.\nallowed-tools: arbitrary_admin_tool\n---\n`,
    "utf8",
  );
  const [record] = await createRuntime(bundle).runtime.start();
  assert.equal(record?.errorCode, "SKILL_DECLARATION_INVALID");
  assert.equal(record?.failureStage, "artifact");
});
