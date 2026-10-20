import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityTools } from "../../packages/agent-runtime/dist/index.js";
import {
  CapabilityCatalog,
  CapabilityExecutor,
  CapabilityRegistry,
} from "../../core/capability/dist/index.js";
import {
  defineCapability,
  implementCapability,
} from "../../packages/plugin-sdk/dist/index.js";
import { z } from "../../packages/plugin-sdk/node_modules/zod/index.js";

const pluginSource = {
  type: "plugin",
  id: "metadata-query",
  namespace: "acme",
};

function createMetadataCapability(overrides = {}) {
  return defineCapability({
    id: "acme.metadata.get",
    version: "1.0.0",
    description: "Read metadata for an authorized object.",
    inputSchema: z.object({ objectId: z.string().min(1) }).strict(),
    dataSchema: z.object({ objectId: z.string(), name: z.string() }),
    requiredPermission: "metadata:read",
    riskLevel: "read",
    ...overrides,
  });
}

function executionContext(permissionScopes = ["metadata:read"]) {
  return {
    executionContextId: "e1-execution",
    contextSnapshotId: "e1-context-snapshot",
    traceId: "e1-trace",
    principalId: "user-a",
    permissionScopes,
  };
}

function createProvider(contract) {
  return implementCapability({
    contract,
    execute: (input) =>
      Promise.resolve({
        status: "success",
        data: { objectId: input.objectId, name: "Orders" },
        evidence: [
          {
            id: "e1-evidence",
            source: { type: "service", id: "metadata-service" },
            collectedAt: "2026-10-19T00:00:00+08:00",
            referenceId: `acme:e1:${input.objectId}`,
          },
        ],
        warnings: [],
      }),
  });
}

function bind(registry, contract, provider = createProvider(contract)) {
  registry.registerMany([
    {
      capabilityId: contract.id,
      contractVersion: contract.version,
      pluginId: pluginSource.id,
      pluginVersion: "1.0.0",
      driver: "local",
      provider,
    },
  ]);
}

test("a compile-time unknown capability registers with source metadata and becomes a tool", async () => {
  const contract = createMetadataCapability();
  const catalog = new CapabilityCatalog([]);
  catalog.register(contract, pluginSource);

  const registration = catalog.getRegistration(contract.id, contract.version);
  assert.equal(registration?.source.type, "plugin");
  assert.equal(registration?.source.id, "metadata-query");
  assert.equal(registration?.source.namespace, "acme");

  const registry = new CapabilityRegistry();
  bind(registry, contract);
  const executor = new CapabilityExecutor({ catalog, registry });
  const tools = createCapabilityTools({ catalog, registry, executor });
  assert.deepEqual(tools.map((tool) => tool.name), ["acme_metadata_get"]);

  const result = await executor.execute(
    contract.id,
    contract.version,
    { objectId: "orders" },
    executionContext(),
  );
  assert.equal(result.status, "success");
  assert.deepEqual(result.data, { objectId: "orders", name: "Orders" });
  assert.equal(result.evidence[0]?.referenceId, "acme:e1:orders");
});

test("catalog registration is atomic when a batch contains a duplicate contract", () => {
  const existing = createMetadataCapability();
  const additional = createMetadataCapability({
    id: "acme.metadata.list",
    description: "List authorized metadata.",
  });
  const conflicting = createMetadataCapability({
    description: "Conflicting schema must not replace the registered contract.",
    dataSchema: z.object({ objectId: z.string(), label: z.string() }),
  });
  const catalog = new CapabilityCatalog([]);
  catalog.register(existing, pluginSource);

  assert.throws(
    () => catalog.registerMany([additional, conflicting], pluginSource),
    /Duplicate capability contract/,
  );
  assert.equal(catalog.get(additional.id, additional.version), undefined);
  assert.equal(catalog.list().length, 1);
});

test("catalog rejects invalid source metadata, namespace misuse, and non-read plugin risk", () => {
  const contract = createMetadataCapability();

  assert.throws(
    () =>
      new CapabilityCatalog([]).register(contract, {
        type: "plugin",
        id: "Invalid Plugin Id",
        namespace: "acme",
      }),
    /Invalid string/,
  );
  assert.throws(
    () =>
      new CapabilityCatalog([]).register(contract, {
        type: "plugin",
        id: "metadata-query",
        namespace: "other",
      }),
    /approved 'other' namespace/,
  );
  assert.throws(
    () =>
      new CapabilityCatalog([]).register(
        createMetadataCapability({ id: "data_map.private_lookup" }),
        { type: "plugin", id: "metadata-query", namespace: "data_map" },
      ),
    /reserved for platform capabilities/,
  );
  assert.throws(
    () =>
      new CapabilityCatalog([]).register(
        createMetadataCapability({ riskLevel: "write" }),
        pluginSource,
      ),
    /must be read-only/,
  );
});

test("catalog rejects malformed contract metadata and non-Zod schemas", () => {
  const catalog = new CapabilityCatalog([]);
  assert.throws(
    () =>
      catalog.register(
        createMetadataCapability({ requiredPermission: "metadata-read" }),
        pluginSource,
      ),
    /Invalid capability permission/,
  );
  assert.throws(
    () =>
      catalog.register(
        { ...createMetadataCapability(), inputSchema: {} },
        pluginSource,
      ),
    /must use Zod input and output schemas/,
  );
});

test("a provider without a registered contract fails closed in Tool Factory", () => {
  const contract = createMetadataCapability();
  const catalog = new CapabilityCatalog([]);
  const registry = new CapabilityRegistry();
  bind(registry, contract);
  const executor = new CapabilityExecutor({ catalog, registry });

  assert.throws(
    () => createCapabilityTools({ catalog, registry, executor }),
    /Unknown capability contract/,
  );
});

test("normalized Tool name collisions are diagnosed deterministically", () => {
  const first = createMetadataCapability({ id: "acme.foo_bar.get" });
  const second = createMetadataCapability({ id: "acme.foo.bar_get" });
  const catalog = new CapabilityCatalog([]);
  catalog.register(first, { type: "plugin", id: "first-plugin", namespace: "acme" });
  catalog.register(second, {
    type: "plugin",
    id: "second-plugin",
    namespace: "acme",
  });

  const registry = new CapabilityRegistry();
  bind(registry, first);
  bind(registry, second);
  const executor = new CapabilityExecutor({ catalog, registry });

  assert.throws(
    () => createCapabilityTools({ catalog, registry, executor }),
    /Capability tool name conflict for 'acme_foo_bar_get'/,
  );
});
