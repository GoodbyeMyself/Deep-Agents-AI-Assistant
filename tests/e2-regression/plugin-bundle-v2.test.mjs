import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createCapabilityTools } from "../../packages/agent-runtime/dist/index.js";
import {
  CapabilityCatalog,
  CapabilityExecutor,
  CapabilityRegistry,
} from "../../core/capability/dist/index.js";
import { PluginRuntime } from "../../packages/plugin-runtime/dist/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const pluginSdkUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/dist/index.js"),
).href;
const zodUrl = pathToFileURL(
  resolve(repositoryRoot, "packages/plugin-sdk/node_modules/zod/index.js"),
).href;
const temporaryRoots = [];

test.after(async () => {
  await Promise.all(
    temporaryRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

function pluginModule(options) {
  const permission = options.modulePermission ?? "metadata:read";
  const initialize = options.initializeFailure
    ? 'initialize: () => Promise.reject(new Error("expected initialization failure")),'
    : "initialize: () => Promise.resolve(),";
  return `
import { defineCapability, definePlugin, implementCapability } from ${JSON.stringify(pluginSdkUrl)};
import { z } from ${JSON.stringify(zodUrl)};

const contract = defineCapability({
  id: ${JSON.stringify(options.capabilityId)},
  version: "1.0.0",
  description: "Read metadata for an authorized object.",
  inputSchema: z.object({ objectId: z.string().min(1) }).strict(),
  dataSchema: z.object({ objectId: z.string(), name: z.string() }),
  requiredPermission: ${JSON.stringify(permission)},
  riskLevel: "read",
});

export default definePlugin(() => ({
  contracts: [contract],
  capabilities: [implementCapability({
    contract,
    execute: (input) => Promise.resolve({
      status: "success",
      data: { objectId: input.objectId, name: "Orders" },
      evidence: [{
        id: "e2-evidence",
        source: { type: "service", id: "metadata-service" },
        collectedAt: "2026-10-20T00:00:00+08:00",
        referenceId: "e2:" + input.objectId,
      }],
      warnings: [],
    }),
  })],
  ${initialize}
  healthCheck: () => Promise.resolve({ ok: true }),
}));
`;
}

async function createBundle(options = {}) {
  const pluginId = options.pluginId ?? "metadata-query";
  const namespace = options.namespace ?? "acme";
  const capabilityId = options.capabilityId ?? `${namespace}.metadata.get`;
  const requiredPermission = options.requiredPermission ?? "metadata:read";
  const installRoot = await mkdtemp(join(tmpdir(), "assistant-e2-"));
  temporaryRoots.push(installRoot);
  const pluginRoot = join(installRoot, pluginId);
  await mkdir(join(pluginRoot, "dist"), { recursive: true });
  if (options.createSkill) {
    await mkdir(join(pluginRoot, "skills", "metadata-query"), { recursive: true });
    await writeFile(
      join(pluginRoot, "skills", "metadata-query", "SKILL.md"),
      "---\nname: metadata-query\ndescription: Query authorized metadata with the plugin Tool.\n---\n\n# Metadata Query\n",
      "utf8",
    );
  }
  await writeFile(
    join(pluginRoot, "plugin.json"),
    JSON.stringify({
      manifestVersion: "2",
      id: pluginId,
      name: "Metadata Query Plugin",
      version: "1.0.0",
      apiVersion: "2",
      namespace,
      runtime: { type: "local", entry: "./dist/index.mjs" },
      capabilities: [
        {
          id: capabilityId,
          contractVersion: "1.0.0",
          contractSource: pluginId,
          requiredPermission,
          riskLevel: options.riskLevel ?? "read",
        },
      ],
      ...(options.skills === undefined ? {} : { skills: options.skills }),
    }),
    "utf8",
  );
  await writeFile(
    join(pluginRoot, "dist", "index.mjs"),
    pluginModule({ ...options, capabilityId }),
    "utf8",
  );
  return { capabilityId, installRoot, pluginId };
}

function runtimeFor(bundle, overrides = {}) {
  const catalog = overrides.catalog ?? new CapabilityCatalog([]);
  const registry = overrides.registry ?? new CapabilityRegistry();
  const runtime = new PluginRuntime({
    installDir: bundle.installRoot,
    approvedPluginIds: new Set([bundle.pluginId]),
    approvedNamespaces: new Set(overrides.approvedNamespaces ?? ["acme"]),
    approvedPermissions: new Set(overrides.approvedPermissions ?? ["metadata:read"]),
    catalog,
    capabilityRegistry: registry,
  });
  return { catalog, registry, runtime };
}

function executionContext(permissionScopes = ["metadata:read"]) {
  return {
    executionContextId: "e2-execution",
    contextSnapshotId: "e2-context",
    traceId: "e2-trace",
    principalId: "user-a",
    permissionScopes,
  };
}

test("a trusted Manifest V2 bundle contributes a new contract, provider, and tool", async () => {
  const bundle = await createBundle({
    createSkill: true,
    skills: ["./skills/metadata-query"],
  });
  const { catalog, registry, runtime } = runtimeFor(bundle);
  const records = await runtime.start();

  assert.equal(records.length, 1);
  assert.equal(records[0]?.status, "ready");
  assert.equal(records[0]?.manifestVersion, "2");
  assert.equal(records[0]?.namespace, "acme");
  assert.equal(records[0]?.capabilities?.[0]?.contractSource, bundle.pluginId);
  assert.deepEqual(records[0]?.skillPaths, ["./skills/metadata-query"]);
  assert.equal(
    catalog.getRegistration(bundle.capabilityId, "1.0.0")?.source.id,
    bundle.pluginId,
  );
  assert.equal(registry.resolve(bundle.capabilityId, "1.0.0")?.pluginId, bundle.pluginId);

  const executor = new CapabilityExecutor({ catalog, registry });
  const tools = createCapabilityTools({ catalog, registry, executor });
  assert.deepEqual(tools.map((tool) => tool.name), ["acme_metadata_get"]);
  const result = await executor.execute(
    bundle.capabilityId,
    "1.0.0",
    { objectId: "orders" },
    executionContext(),
  );
  assert.equal(result.status, "success");
  assert.equal(result.evidence[0]?.referenceId, "e2:orders");

  const denied = await executor.execute(
    bundle.capabilityId,
    "1.0.0",
    { objectId: "orders" },
    executionContext([]),
  );
  assert.equal(denied.status, "error");
  assert.equal(denied.error?.code, "FORBIDDEN");
});

test("removing a V2 bundle before restart removes its contract and provider", async () => {
  const bundle = await createBundle();
  const first = runtimeFor(bundle);
  await first.runtime.start();
  assert.ok(first.catalog.get(bundle.capabilityId, "1.0.0"));

  const emptyRoot = await mkdtemp(join(tmpdir(), "assistant-e2-empty-"));
  temporaryRoots.push(emptyRoot);
  const restarted = runtimeFor({ ...bundle, installRoot: emptyRoot });
  const records = await restarted.runtime.start();
  assert.deepEqual(records, []);
  assert.equal(restarted.catalog.get(bundle.capabilityId, "1.0.0"), undefined);
  assert.equal(restarted.registry.resolve(bundle.capabilityId, "1.0.0"), undefined);
});

test("a provider conflict rolls back the V2 contract registration", async () => {
  const bundle = await createBundle();
  const registry = new CapabilityRegistry();
  const originalProvider = {
    id: bundle.capabilityId,
    contractVersion: "1.0.0",
    execute: () => Promise.resolve({}),
  };
  registry.registerMany([
    {
      capabilityId: bundle.capabilityId,
      contractVersion: "1.0.0",
      pluginId: "existing-plugin",
      pluginVersion: "1.0.0",
      driver: "local",
      provider: originalProvider,
    },
  ]);
  const { catalog, runtime } = runtimeFor(bundle, { registry });
  const records = await runtime.start();

  assert.equal(records[0]?.errorCode, "CAPABILITY_PROVIDER_CONFLICT");
  assert.equal(records[0]?.failureStage, "register");
  assert.equal(catalog.get(bundle.capabilityId, "1.0.0"), undefined);
  assert.equal(registry.resolve(bundle.capabilityId, "1.0.0")?.provider, originalProvider);
});

test("initialization failure rolls back both V2 contract and provider", async () => {
  const bundle = await createBundle({ initializeFailure: true });
  const { catalog, registry, runtime } = runtimeFor(bundle);
  const records = await runtime.start();

  assert.equal(records[0]?.errorCode, "PLUGIN_INITIALIZE_FAILED");
  assert.equal(records[0]?.failureStage, "initialize");
  assert.equal(catalog.get(bundle.capabilityId, "1.0.0"), undefined);
  assert.equal(registry.resolve(bundle.capabilityId, "1.0.0"), undefined);
});

test("V2 approval policy rejects namespaces, permissions, risks, and escaping Skill paths", async () => {
  const namespaceBundle = await createBundle({ namespace: "other" });
  const permissionBundle = await createBundle({ requiredPermission: "metadata:admin" });
  const riskBundle = await createBundle({ riskLevel: "write" });
  const skillBundle = await createBundle({ skills: ["../outside"] });

  const namespaceRecord = (await runtimeFor(namespaceBundle).runtime.start())[0];
  const permissionRecord = (await runtimeFor(permissionBundle).runtime.start())[0];
  const riskRecord = (await runtimeFor(riskBundle).runtime.start())[0];
  const skillRecord = (await runtimeFor(skillBundle).runtime.start())[0];

  assert.equal(namespaceRecord?.errorCode, "NAMESPACE_NOT_APPROVED");
  assert.equal(permissionRecord?.errorCode, "PERMISSION_NOT_APPROVED");
  assert.equal(riskRecord?.errorCode, "RISK_NOT_APPROVED");
  assert.equal(skillRecord?.errorCode, "SKILL_PATH_INVALID");
});

test("a Manifest V2 contract metadata mismatch fails before registration", async () => {
  const bundle = await createBundle({ modulePermission: "metadata:other" });
  const { catalog, registry, runtime } = runtimeFor(bundle);
  const records = await runtime.start();

  assert.equal(records[0]?.errorCode, "CONTRACT_DECLARATION_MISMATCH");
  assert.equal(records[0]?.failureStage, "inspect");
  assert.equal(catalog.list().length, 0);
  assert.equal(registry.list().length, 0);
});
