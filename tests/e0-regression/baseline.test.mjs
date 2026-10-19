import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";

import { createCapabilityTools } from "../../packages/agent-runtime/dist/index.js";
import {
  CapabilityExecutor,
  CapabilityRegistry,
  createStandardCapabilityCatalog,
} from "../../core/capability/dist/index.js";
import { PluginRuntime, pluginManifestSchema } from "../../packages/plugin-runtime/dist/index.js";

const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const expectedCapabilities = ["data_map.search_objects", "data_quality.get_trend"];
const expectedToolNames = ["data_map_search_objects", "data_quality_get_trend"];

function executionContext(permissionScopes) {
  return {
    executionContextId: "e0-execution",
    contextSnapshotId: "e0-context-snapshot",
    traceId: "e0-trace",
    principalId: "user-a",
    tenantId: "tenant-a",
    authorizationRef: "mock-auth:user-a",
    contextObjectId: "orders",
    authorizedObjectIds: ["orders"],
    permissionScopes,
  };
}

function comparableSearchData(data) {
  return {
    objects: data.objects.map((object) => ({
      type: object.type,
      id: object.id,
      name: object.name,
      ...(object.description === undefined ? {} : { description: object.description }),
    })),
    ...(data.nextCursor === undefined ? {} : { nextCursor: data.nextCursor }),
  };
}

async function loadAdapter(adapterDirectory, pluginId) {
  const catalog = createStandardCapabilityCatalog();
  const registry = new CapabilityRegistry();
  const auditRecords = [];
  const runtime = new PluginRuntime({
    installDir: resolve(repositoryRoot, "adapters", adapterDirectory),
    approvedPluginIds: new Set([pluginId]),
    catalog,
    capabilityRegistry: registry,
  });
  const records = await runtime.start();
  const executor = new CapabilityExecutor({
    catalog,
    registry,
    audit: {
      write(record) {
        auditRecords.push(record);
        return Promise.resolve();
      },
    },
  });
  const tools = createCapabilityTools({ catalog, registry, executor });
  return { auditRecords, catalog, executor, records, registry, tools };
}

async function readManifest(adapterDirectory) {
  const contents = await readFile(
    resolve(repositoryRoot, "adapters", adapterDirectory, "plugin.json"),
    "utf8",
  );
  return pluginManifestSchema.parse(JSON.parse(contents));
}

async function withTemporaryManifest(manifest, run) {
  const directory = await mkdtemp(join(tmpdir(), "assistant-e0-plugin-"));
  try {
    await writeFile(join(directory, "plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("standard catalog and both adapters retain the Manifest V1 capability baseline", async () => {
  const catalogIds = createStandardCapabilityCatalog()
    .list()
    .map((contract) => contract.id)
    .sort();
  assert.deepEqual(catalogIds, expectedCapabilities);

  for (const adapterDirectory of ["demo-product-a", "demo-product-b"]) {
    const manifest = await readManifest(adapterDirectory);
    assert.equal(manifest.manifestVersion, "1");
    assert.equal(manifest.apiVersion, "1");
    assert.deepEqual(
      manifest.capabilities.map((capability) => capability.id).sort(),
      expectedCapabilities,
    );
  }
});

test("A and B plugins are discovered as ready and generate the same tool names", async () => {
  for (const [adapterDirectory, pluginId] of [
    ["demo-product-a", "demo-product-a"],
    ["demo-product-b", "demo-product-b"],
  ]) {
    const loaded = await loadAdapter(adapterDirectory, pluginId);
    assert.equal(loaded.records.length, 1);
    assert.equal(loaded.records[0]?.status, "ready");
    assert.equal(loaded.records[0]?.pluginId, pluginId);
    assert.deepEqual(
      loaded.registry
        .list()
        .map((binding) => binding.capabilityId)
        .sort(),
      expectedCapabilities,
    );
    assert.deepEqual(loaded.tools.map((tool) => tool.name).sort(), expectedToolNames);
  }
});

test("A and B providers preserve equivalent standard data and traceable evidence", async () => {
  const outputs = [];
  for (const [adapterDirectory, pluginId, evidencePrefix] of [
    ["demo-product-a", "demo-product-a", "product-a"],
    ["demo-product-b", "demo-product-b", "product-b"],
  ]) {
    const loaded = await loadAdapter(adapterDirectory, pluginId);
    const search = await loaded.executor.execute(
      "data_map.search_objects",
      "1.0.0",
      { keyword: "orders", limit: 10 },
      executionContext(["data_map:read"]),
    );
    const trend = await loaded.executor.execute(
      "data_quality.get_trend",
      "1.0.0",
      {
        tableId: "orders",
        startTime: "2026-10-07T00:00:00+08:00",
        endTime: "2026-10-13T23:59:59+08:00",
      },
      executionContext(["data_quality:read"]),
    );

    assert.equal(search.status, "success");
    assert.equal(search.evidence.length, 1);
    assert.match(search.evidence[0].referenceId, new RegExp(`^${evidencePrefix}:`));
    assert.match(search.data.objects[0].sourceRef, new RegExp(`^${evidencePrefix}:`));
    assert.equal(trend.status, "partial");
    assert.equal(trend.evidence.length, 1);
    assert.match(trend.evidence[0].referenceId, new RegExp(`^${evidencePrefix}:`));
    assert.equal(JSON.stringify({ search, trend }).includes("mock-auth:user-a"), false);
    assert.deepEqual(
      loaded.auditRecords.map((record) => record.capabilityId),
      expectedCapabilities,
    );
    outputs.push({ search, trend });
  }

  assert.deepEqual(
    comparableSearchData(outputs[0].search.data),
    comparableSearchData(outputs[1].search.data),
  );
  assert.deepEqual(outputs[0].trend.data, outputs[1].trend.data);
  assert.deepEqual(
    outputs[0].trend.warnings.map((warning) => warning.code),
    outputs[1].trend.warnings.map((warning) => warning.code),
  );
});

test("executor denies a capability before provider execution when permission is absent", async () => {
  const loaded = await loadAdapter("demo-product-a", "demo-product-a");
  const result = await loaded.executor.execute(
    "data_quality.get_trend",
    "1.0.0",
    {
      tableId: "orders",
      startTime: "2026-10-07T00:00:00+08:00",
      endTime: "2026-10-13T23:59:59+08:00",
    },
    executionContext(["data_map:read"]),
  );

  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "FORBIDDEN");
  assert.equal(loaded.auditRecords.at(-1)?.outcome, "denied");
});

test("runtime rejects an installed but unapproved plugin", async () => {
  const catalog = createStandardCapabilityCatalog();
  const registry = new CapabilityRegistry();
  const runtime = new PluginRuntime({
    installDir: resolve(repositoryRoot, "adapters", "demo-product-a"),
    approvedPluginIds: new Set(),
    catalog,
    capabilityRegistry: registry,
  });

  const records = await runtime.start();
  assert.equal(records[0]?.status, "failed");
  assert.equal(records[0]?.errorCode, "PLUGIN_NOT_APPROVED");
  assert.equal(registry.list().length, 0);
});

test("runtime rejects a Manifest V1 declaration for an unknown contract", async () => {
  await withTemporaryManifest(
    {
      manifestVersion: "1",
      id: "unknown-contract-plugin",
      name: "Unknown Contract Plugin",
      version: "1.0.0",
      apiVersion: "1",
      runtime: { type: "local", entry: "./dist/index.js" },
      capabilities: [{ id: "private.unknown", contractVersion: "1.0.0" }],
    },
    async (installDir) => {
      const registry = new CapabilityRegistry();
      const runtime = new PluginRuntime({
        installDir,
        approvedPluginIds: new Set(["unknown-contract-plugin"]),
        catalog: createStandardCapabilityCatalog(),
        capabilityRegistry: registry,
      });
      const records = await runtime.start();
      assert.equal(records[0]?.status, "failed");
      assert.equal(records[0]?.errorCode, "CONTRACT_UNKNOWN");
      assert.equal(registry.list().length, 0);
    },
  );
});

test("runtime rejects a local plugin entry that escapes the approved root", async () => {
  await withTemporaryManifest(
    {
      manifestVersion: "1",
      id: "path-escape-plugin",
      name: "Path Escape Plugin",
      version: "1.0.0",
      apiVersion: "1",
      runtime: { type: "local", entry: "./../../outside.js" },
      capabilities: [{ id: "data_map.search_objects", contractVersion: "1.0.0" }],
    },
    async (installDir) => {
      const registry = new CapabilityRegistry();
      const runtime = new PluginRuntime({
        installDir,
        approvedPluginIds: new Set(["path-escape-plugin"]),
        catalog: createStandardCapabilityCatalog(),
        capabilityRegistry: registry,
      });
      const records = await runtime.start();
      assert.equal(records[0]?.status, "failed");
      assert.equal(records[0]?.errorCode, "ENTRY_PATH_INVALID");
      assert.equal(registry.list().length, 0);
    },
  );
});
