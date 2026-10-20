import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  CapabilityCatalog,
  CapabilityExecutor,
  CapabilityRegistry,
} from "../../core/capability/dist/index.js";
import {
  DATA_MAP_CAPABILITY_SOURCE,
  dataMapCapabilityContracts,
  dataMapGetObjectMetadataV1,
} from "../../domains/data-map/dist/index.js";
import { verifyDataMapProvider } from "../../domains/data-map/contract-tests/provider-suite.mjs";
import {
  DATA_QUALITY_CAPABILITY_SOURCE,
  dataQualityCapabilityContracts,
  qualityTrendV1,
} from "../../domains/data-quality/dist/index.js";
import { verifyDataQualityProvider } from "../../domains/data-quality/contract-tests/provider-suite.mjs";
import {
  createStandardCapabilityCatalog,
  standardCapabilityContracts,
} from "../../packages/capability-contracts/dist/index.js";
import { PluginRuntime } from "../../packages/plugin-runtime/dist/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function executionContext(permissionScopes = ["data_map:read", "data_quality:read"]) {
  return {
    executionContextId: "e4-execution",
    contextSnapshotId: "e4-context",
    traceId: "e4-trace",
    principalId: "user-a",
    tenantId: "tenant-a",
    authorizationRef: "mock-auth:user-a",
    authorizedObjectIds: ["orders"],
    permissionScopes,
  };
}

async function loadAdapter(adapterDirectory) {
  const catalog = new CapabilityCatalog();
  catalog.registerMany(dataMapCapabilityContracts, DATA_MAP_CAPABILITY_SOURCE);
  catalog.registerMany(dataQualityCapabilityContracts, DATA_QUALITY_CAPABILITY_SOURCE);
  const registry = new CapabilityRegistry();
  const runtime = new PluginRuntime({
    installDir: resolve(repositoryRoot, "adapters", adapterDirectory),
    approvedPluginIds: new Set([adapterDirectory]),
    catalog,
    capabilityRegistry: registry,
  });
  const records = await runtime.start();
  assert.equal(records[0]?.status, "ready");
  return { catalog, executor: new CapabilityExecutor({ catalog, registry }), registry };
}

test("Core remains generic while the deprecated compatibility package preserves standard exports", async () => {
  const core = await import("../../core/capability/dist/index.js");
  assert.equal("dataMapSearchObjectsV1" in core, false);
  assert.deepEqual(
    standardCapabilityContracts.map((contract) => contract.id).sort(),
    [
      "data_map.get_object_metadata",
      "data_map.search_objects",
      "data_quality.get_trend",
    ],
  );
  const catalog = createStandardCapabilityCatalog();
  assert.equal(
    catalog.getRegistration("data_map.search_objects", "1.0.0")?.source.id,
    "@assistant/capability-data-map",
  );
  assert.equal(
    catalog.getRegistration("data_quality.get_trend", "1.0.0")?.source.id,
    "@assistant/capability-data-quality",
  );
});

test("Product A and B pass the same data-map and data-quality provider suites", async () => {
  const results = [];
  for (const adapter of ["demo-product-a", "demo-product-b"]) {
    const loaded = await loadAdapter(adapter);
    const dataMap = await verifyDataMapProvider(loaded.executor, executionContext());
    const quality = await verifyDataQualityProvider(loaded.executor, executionContext());
    results.push({ dataMap, quality });
  }
  assert.deepEqual(results[0]?.dataMap.metadata.data, results[1]?.dataMap.metadata.data);
  assert.deepEqual(results[0]?.quality.data, results[1]?.quality.data);
});

test("metadata object and field authorization fail closed before model-visible output", async () => {
  const loaded = await loadAdapter("demo-product-a");
  const forbidden = await loaded.executor.execute(
    dataMapGetObjectMetadataV1.id,
    dataMapGetObjectMetadataV1.version,
    { objectType: "data_table", objectId: "not-authorized" },
    executionContext(),
  );
  assert.equal(forbidden.status, "error");
  assert.equal(forbidden.error?.code, "FORBIDDEN");
  assert.equal(JSON.stringify(forbidden).includes("customer_ssn"), false);

  const sensitive = await loaded.executor.execute(
    dataMapGetObjectMetadataV1.id,
    dataMapGetObjectMetadataV1.version,
    { objectType: "data_table", objectId: "orders", fieldNames: ["customer_ssn"] },
    executionContext(["data_map:read", "data_map:sensitive_read"]),
  );
  assert.equal(sensitive.status, "success");
  assert.equal(sensitive.data?.fields[0]?.classification, "restricted");
});

test("a catalogued but unbound metadata capability returns UNSUPPORTED", async () => {
  const catalog = new CapabilityCatalog();
  catalog.registerMany(dataMapCapabilityContracts, DATA_MAP_CAPABILITY_SOURCE);
  const executor = new CapabilityExecutor({ catalog, registry: new CapabilityRegistry() });
  const result = await executor.execute(
    dataMapGetObjectMetadataV1.id,
    dataMapGetObjectMetadataV1.version,
    { objectType: "data_table", objectId: "orders" },
    executionContext(["data_map:read"]),
  );
  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "UNSUPPORTED");
});

test("same-version semantic conflicts and quality units fail deterministically", async () => {
  const catalog = new CapabilityCatalog();
  catalog.register(dataMapGetObjectMetadataV1, DATA_MAP_CAPABILITY_SOURCE);
  assert.throws(
    () =>
      catalog.register(
        { ...dataMapGetObjectMetadataV1, description: "Different semantics for the same key." },
        DATA_MAP_CAPABILITY_SOURCE,
      ),
    /Duplicate capability contract/,
  );

  const qualityCatalog = new CapabilityCatalog();
  qualityCatalog.register(qualityTrendV1, DATA_QUALITY_CAPABILITY_SOURCE);
  const registry = new CapabilityRegistry();
  registry.registerMany([
    {
      capabilityId: qualityTrendV1.id,
      contractVersion: qualityTrendV1.version,
      pluginId: "unit-conflict",
      pluginVersion: "1.0.0",
      driver: "local",
      provider: {
        id: qualityTrendV1.id,
        contractVersion: qualityTrendV1.version,
        execute: () =>
          Promise.resolve({
            status: "success",
            data: {
              tableId: "orders",
              metric: "quality_score",
              unit: "ratio",
              aggregation: "daily",
              timezone: "Asia/Shanghai",
              points: [{ time: "2026-10-13", value: 0.96 }],
            },
            evidence: [],
            warnings: [],
          }),
      },
    },
  ]);
  const result = await new CapabilityExecutor({ catalog: qualityCatalog, registry }).execute(
    qualityTrendV1.id,
    qualityTrendV1.version,
    {
      tableId: "orders",
      startTime: "2026-10-13T00:00:00+08:00",
      endTime: "2026-10-13T23:59:59+08:00",
    },
    executionContext(["data_quality:read"]),
  );
  assert.equal(result.status, "error");
  assert.equal(result.error?.code, "SCHEMA_MISMATCH");
});

test("A and B manifests declare the new capability without Agent or UI changes", async () => {
  for (const adapter of ["demo-product-a", "demo-product-b"]) {
    const manifest = JSON.parse(
      await readFile(resolve(repositoryRoot, "adapters", adapter, "plugin.json"), "utf8"),
    );
    assert.equal(
      manifest.capabilities.some(
        (capability) =>
          capability.id === "data_map.get_object_metadata" &&
          capability.contractVersion === "1.0.0",
      ),
      true,
    );
  }
});
