import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createCapabilityTools } from "../../packages/agent-runtime/dist/index.js";
import { createStandardCapabilityCatalog } from "../../packages/capability-contracts/dist/index.js";
import {
  CapabilityExecutor,
  CapabilityRegistry,
} from "../../core/capability/dist/index.js";
import { PluginRuntime } from "../../packages/plugin-runtime/dist/index.js";
import {
  diagnosePluginRelease,
  disablePluginRelease,
  installPluginRelease,
  rollbackPluginRelease,
  scaffoldPluginBundle,
  stampPluginBundle,
} from "../../deploy/plugin-release.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const pluginSdkUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/dist/index.js"),
).href;
const zodUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/node_modules/zod/index.js"),
).href;
const dataMapUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/capability-data-map/dist/index.js"),
).href;
const temporaryRoots = [];

test.after(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function privateModule(capabilityId, label, badOutput = false) {
  return `
import { defineCapability, definePlugin, implementCapability } from ${JSON.stringify(pluginSdkUrl)};
import { z } from ${JSON.stringify(zodUrl)};
const contract = defineCapability({
  id: ${JSON.stringify(capabilityId)}, version: "1.0.0", description: "Read a private summary.",
  inputSchema: z.object({ objectId: z.string().min(1) }).strict(),
  dataSchema: z.object({ objectId: z.string(), summary: z.string() }).strict(),
  requiredPermission: "metadata:read", riskLevel: "read",
});
export default definePlugin(() => ({
  contracts: [contract],
  capabilities: [implementCapability({ contract, execute: (input) => Promise.resolve(${badOutput ? `{
    status: "success", data: { objectId: input.objectId, summary: ${JSON.stringify(label)} },
    evidence: [{ id: "bad", source: { type: "service", id: "private" }, collectedAt: "not-a-date", referenceId: "bad" }], warnings: [],
  }` : `{
    status: "success", data: { objectId: input.objectId, summary: ${JSON.stringify(label)} },
    evidence: [{ id: "private", source: { type: "service", id: "private" }, collectedAt: "2026-10-20T00:00:00+08:00", referenceId: "private:" + input.objectId }], warnings: [],
  }`}) })],
  healthCheck: () => Promise.resolve({ ok: true }),
}));`;
}

function standardModule(label) {
  return `
import { definePlugin, implementCapability } from ${JSON.stringify(pluginSdkUrl)};
import { dataMapGetObjectMetadataV1 } from ${JSON.stringify(dataMapUrl)};
export default definePlugin(() => ({ capabilities: [implementCapability({
  contract: dataMapGetObjectMetadataV1,
  execute: (input) => Promise.resolve({
    status: "success",
    data: { object: { type: input.objectType, id: input.objectId, name: ${JSON.stringify(label)} }, fields: [] },
    evidence: [{ id: "standard", source: { type: "service", id: ${JSON.stringify(label)} }, collectedAt: "2026-10-20T00:00:00+08:00", referenceId: ${JSON.stringify(label)} + ":" + input.objectId }],
    warnings: [],
  }),
})], healthCheck: () => Promise.resolve({ ok: true }) }));`;
}

async function createBundle(options) {
  const root = await temporaryRoot("assistant-e5-bundle-");
  const pluginRoot = join(root, options.pluginId);
  await mkdir(join(pluginRoot, "dist"), { recursive: true });
  const capabilityId =
    options.capabilityId ??
    (options.standard
      ? "data_map.get_object_metadata"
      : `${options.namespace}.metadata.lookup`);
  const permission = options.standard ? "data_map:read" : "metadata:read";
  const contractSource = options.standard ? "@assistant/capability-data-map" : options.pluginId;
  const skills = options.standard
    ? undefined
    : [
        {
          path: `./skills/${options.pluginId}-lookup`,
          requiredCapabilities: [{ id: capabilityId, contractVersion: "1.0.0" }],
        },
      ];
  if (!options.standard) {
    const skillRoot = join(pluginRoot, "skills", `${options.pluginId}-lookup`);
    await mkdir(skillRoot, { recursive: true });
    await writeFile(
      join(skillRoot, "SKILL.md"),
      `---\nname: ${options.pluginId}-lookup\ndescription: Query authorized private metadata and cite Evidence.\nallowed-tools: ${capabilityId.replaceAll(/[^a-zA-Z0-9_]/g, "_")}\n---\n\n# Workflow\nUse the Tool and obey server authorization.\n`,
      "utf8",
    );
  }
  await writeFile(
    join(pluginRoot, "dist", "index.mjs"),
    options.standard
      ? standardModule(options.label)
      : privateModule(capabilityId, options.label, options.badOutput),
    "utf8",
  );
  await writeFile(
    join(pluginRoot, "plugin.json"),
    JSON.stringify({
      manifestVersion: "2",
      id: options.pluginId,
      name: options.pluginId,
      version: options.version ?? "1.0.0",
      apiVersion: "2",
      namespace: options.namespace,
      runtime: { type: "local", entry: "./dist/index.mjs" },
      capabilities: [
        {
          id: capabilityId,
          contractVersion: "1.0.0",
          contractSource,
          requiredPermission: permission,
          riskLevel: "read",
        },
      ],
      ...(skills ? { skills } : {}),
    }),
    "utf8",
  );
  await writeFile(
    join(pluginRoot, "plugin-release.json"),
    JSON.stringify({
      formatVersion: 1,
      configVersion: options.releaseConfigVersion ?? 1,
      compatibleConfigVersions: options.compatibleConfigVersions ?? [1],
      breaking: options.breaking ?? false,
    }),
    "utf8",
  );
  const stamped = await stampPluginBundle(pluginRoot);
  return { capabilityId, pluginRoot, stamped };
}

function approval(bundle, configVersion = 1) {
  return {
    pluginId: bundle.stamped.manifest.id,
    namespace: bundle.stamped.manifest.namespace,
    artifactHash: bundle.stamped.artifactHash,
    permissions: bundle.stamped.manifest.capabilities.map(
      (capability) => capability.requiredPermission,
    ),
    configVersion,
  };
}

test("the scaffold creates a complete Manifest V2 development package", async () => {
  const root = await temporaryRoot("assistant-e5-scaffold-");
  const target = join(root, "orders-metadata");
  await scaffoldPluginBundle({
    targetDir: target,
    pluginId: "orders-metadata",
    namespace: "acme",
  });
  const manifest = JSON.parse(await readFile(join(target, "plugin.json"), "utf8"));
  assert.equal(manifest.id, "orders-metadata");
  assert.equal(manifest.capabilities[0].id, "acme.metadata.lookup");
  await access(join(target, "src", "index.ts"));
  await access(join(target, "skills", "orders-metadata-lookup", "SKILL.md"));
  await access(join(target, "tests", "contract.test.mjs"));
  assert.doesNotMatch(await readFile(join(target, "src", "index.ts"), "utf8"), /__/u);
});

test("install, compatible config upgrade, failed upgrade, rollback, disable, and diagnostics are recoverable", async () => {
  const deployment = await temporaryRoot("assistant-e5-deployment-");
  const first = await createBundle({
    pluginId: "release-sample",
    namespace: "release_a",
    label: "v1",
  });
  const firstState = await installPluginRelease({
    bundleDir: first.pluginRoot,
    deploymentDir: deployment,
    approval: approval(first),
  });
  assert.equal(firstState.current.version, "1.0.0");

  const second = await createBundle({
    pluginId: "release-sample",
    namespace: "release_a",
    label: "v2",
    version: "1.1.0",
    releaseConfigVersion: 2,
    compatibleConfigVersions: [1, 2],
  });
  const secondState = await installPluginRelease({
    bundleDir: second.pluginRoot,
    deploymentDir: deployment,
    approval: approval(second, 2),
  });
  assert.equal(secondState.current.version, "1.1.0");
  assert.equal(secondState.current.configVersion, 2);

  const incompatible = await createBundle({
    pluginId: "release-sample",
    namespace: "release_a",
    label: "v3",
    version: "1.2.0",
    releaseConfigVersion: 3,
    compatibleConfigVersions: [3],
  });
  await assert.rejects(
    installPluginRelease({
      bundleDir: incompatible.pluginRoot,
      deploymentDir: deployment,
      approval: approval(incompatible, 2),
    }),
    /Config version 2 is not compatible/u,
  );
  assert.equal((await diagnosePluginRelease(deployment, "release-sample")).current.version, "1.1.0");

  const contractBreaking = await createBundle({
    pluginId: "release-sample",
    namespace: "release_a",
    capabilityId: "release_a.metadata.lookup_v2",
    label: "breaking",
    version: "2.0.0",
    releaseConfigVersion: 2,
    compatibleConfigVersions: [2],
  });
  await assert.rejects(
    installPluginRelease({
      bundleDir: contractBreaking.pluginRoot,
      deploymentDir: deployment,
      approval: approval(contractBreaking, 2),
    }),
    /removes contracts without approval/u,
  );
  assert.equal((await diagnosePluginRelease(deployment, "release-sample")).current.version, "1.1.0");

  await writeFile(join(second.pluginRoot, "dist", "index.mjs"), "tampered", "utf8");
  await assert.rejects(
    installPluginRelease({
      bundleDir: second.pluginRoot,
      deploymentDir: deployment,
      approval: approval(second, 2),
    }),
    /hash does not match/u,
  );
  assert.equal((await diagnosePluginRelease(deployment, "release-sample")).verification, "verified");

  const rolledBack = await rollbackPluginRelease(deployment, "release-sample");
  assert.equal(rolledBack.current.version, "1.0.0");
  const disabled = await disablePluginRelease(deployment, "release-sample");
  assert.equal(disabled.status, "disabled");
  assert.equal((await diagnosePluginRelease(deployment, "release-sample")).active, false);
});

async function installForInstance(deployment, bundle) {
  return installPluginRelease({
    bundleDir: bundle.pluginRoot,
    deploymentDir: deployment,
    approval: approval(bundle),
  });
}

async function startInstance(deployment, bundles) {
  const catalog = createStandardCapabilityCatalog();
  const registry = new CapabilityRegistry();
  const runtime = new PluginRuntime({
    installDir: join(deployment, "active"),
    approvedPluginIds: new Set(bundles.map((bundle) => bundle.stamped.manifest.id)),
    approvedNamespaces: new Set(bundles.map((bundle) => bundle.stamped.manifest.namespace)),
    approvedPermissions: new Set(["data_map:read", "metadata:read"]),
    catalog,
    capabilityRegistry: registry,
  });
  const records = await runtime.start();
  const executor = new CapabilityExecutor({ catalog, registry });
  return { catalog, executor, records, registry, runtime };
}

test("independent A/B deployments expose the same standard capability and different private capabilities", async () => {
  const deploymentA = await temporaryRoot("assistant-e5-product-a-");
  const deploymentB = await temporaryRoot("assistant-e5-product-b-");
  const standardA = await createBundle({
    pluginId: "product-a-standard",
    namespace: "product_a",
    label: "Product A Object",
    standard: true,
  });
  const privateA = await createBundle({
    pluginId: "product-a-private",
    namespace: "product_a",
    label: "A private summary",
  });
  const standardB = await createBundle({
    pluginId: "product-b-standard",
    namespace: "product_b",
    label: "Product B Object",
    standard: true,
  });
  const privateB = await createBundle({
    pluginId: "product-b-private",
    namespace: "product_b",
    label: "B private summary",
  });
  await installForInstance(deploymentA, standardA);
  await installForInstance(deploymentA, privateA);
  await installForInstance(deploymentB, standardB);
  await installForInstance(deploymentB, privateB);

  const instanceA = await startInstance(deploymentA, [standardA, privateA]);
  const instanceB = await startInstance(deploymentB, [standardB, privateB]);
  assert.ok(instanceA.records.every((record) => record.status === "ready"));
  assert.ok(instanceB.records.every((record) => record.status === "ready"));
  assert.deepEqual(
    createCapabilityTools(instanceA).map((tool) => tool.name).sort(),
    ["data_map_get_object_metadata", "product_a_metadata_lookup"],
  );
  assert.deepEqual(
    createCapabilityTools(instanceB).map((tool) => tool.name).sort(),
    ["data_map_get_object_metadata", "product_b_metadata_lookup"],
  );
  assert.equal(instanceA.runtime.skillRegistry.list()[0]?.pluginId, "product-a-private");
  assert.equal(instanceB.runtime.skillRegistry.list()[0]?.pluginId, "product-b-private");
});

test("invalid Evidence is rejected as a schema mismatch before model-visible output", async () => {
  const deployment = await temporaryRoot("assistant-e5-invalid-evidence-");
  const bundle = await createBundle({
    pluginId: "invalid-evidence",
    namespace: "invalid_evidence",
    label: "bad",
    badOutput: true,
  });
  await installForInstance(deployment, bundle);
  const { catalog, registry } = await startInstance(deployment, [bundle]);
  const executor = new CapabilityExecutor({ catalog, registry });
  const result = await executor.execute(
    bundle.capabilityId,
    "1.0.0",
    { objectId: "orders" },
    {
      executionContextId: "e5",
      contextSnapshotId: "e5-snapshot",
      traceId: "e5-trace",
      principalId: "user-a",
      permissionScopes: ["metadata:read"],
    },
  );
  assert.equal(result.error?.code, "SCHEMA_MISMATCH");
  assert.deepEqual(result.evidence, []);
});
