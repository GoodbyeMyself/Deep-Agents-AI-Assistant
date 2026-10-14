import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CapabilityRegistry,
  createStandardCapabilityCatalog,
} from "@assistant/capability-contracts";
import { afterEach, describe, expect, it } from "vitest";

import { PluginRuntime } from "./runtime.js";

const tempRoots: string[] = [];

const qualityDeclaration = {
  id: "data_quality.get_trend",
  contractVersion: "1.0.0",
};

function manifest(
  id: string,
  options: {
    entry?: string;
    capabilities?: Array<{ id: string; contractVersion: string }>;
    apiVersion?: string;
    integrity?: string;
  } = {},
) {
  return {
    manifestVersion: "1",
    id,
    name: id,
    version: "1.0.0",
    apiVersion: options.apiVersion ?? "1",
    runtime: { type: "local", entry: options.entry ?? "./index.mjs" },
    capabilities: options.capabilities ?? [qualityDeclaration],
    ...(options.integrity === undefined ? {} : { integrity: options.integrity }),
  };
}

function moduleSource(capabilities = [qualityDeclaration]): string {
  return `export default () => ({ capabilities: ${JSON.stringify(
    capabilities,
  )}.map((item) => ({ ...item, execute: async () => ({ status: "error", data: null, evidence: [], warnings: [], error: { code: "UNSUPPORTED", message: "fixture", retryable: false } }) })) });`;
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "assistant-plugin-runtime-"));
  tempRoots.push(root);
  return root;
}

async function addPlugin(
  root: string,
  directory: string,
  pluginManifest: object,
  source = moduleSource(),
): Promise<string> {
  const pluginPath = join(root, directory);
  await mkdir(pluginPath, { recursive: true });
  await writeFile(join(pluginPath, "plugin.json"), JSON.stringify(pluginManifest), "utf8");
  await writeFile(join(pluginPath, "index.mjs"), source, "utf8");
  return pluginPath;
}

function runtime(installDir: string, approvedPluginIds: string[]) {
  const registry = new CapabilityRegistry();
  return {
    registry,
    runtime: new PluginRuntime({
      installDir,
      approvedPluginIds: new Set(approvedPluginIds),
      catalog: createStandardCapabilityCatalog(),
      capabilityRegistry: registry,
    }),
  };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("trusted plugin runtime", () => {
  it("discovers, validates, initializes, registers, verifies, and readies a local plugin", async () => {
    const root = await tempRoot();
    await addPlugin(root, "approved", manifest("approved"));
    const setup = runtime(root, ["approved"]);

    const records = await setup.runtime.start();

    expect(records).toEqual([expect.objectContaining({ pluginId: "approved", status: "ready" })]);
    expect(records[0]?.events.map((event) => event.status)).toEqual([
      "discovered",
      "validated",
      "initialized",
      "ready",
    ]);
    expect(records[0]?.artifactHash).toMatch(/^sha256-/);
    expect(setup.registry.resolve("data_quality.get_trend", "1.0.0")?.pluginId).toBe("approved");
  });

  it("does not import an unapproved module", async () => {
    const root = await tempRoot();
    const marker = join(root, "executed.txt");
    await addPlugin(
      root,
      "unapproved",
      manifest("unapproved"),
      `import { writeFile } from "node:fs/promises"; await writeFile(${JSON.stringify(
        marker,
      )}, "executed"); ${moduleSource()}`,
    );
    const setup = runtime(root, []);

    const records = await setup.runtime.start();

    expect(records[0]).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "PLUGIN_NOT_APPROVED" }),
    );
    await expect(access(marker)).rejects.toThrow();
  });

  it("rejects an entry path that escapes the approved plugin root", async () => {
    const root = await tempRoot();
    await addPlugin(root, "escape", manifest("escape", { entry: "../../outside.mjs" }));
    const setup = runtime(root, ["escape"]);

    const records = await setup.runtime.start();

    expect(records[0]).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "ENTRY_PATH_INVALID" }),
    );
  });

  it("rejects manifest and implementation capability mismatches", async () => {
    const root = await tempRoot();
    await addPlugin(
      root,
      "mismatch",
      manifest("mismatch", {
        capabilities: [
          qualityDeclaration,
          { id: "data_map.search_objects", contractVersion: "1.0.0" },
        ],
      }),
      moduleSource([qualityDeclaration]),
    );
    const setup = runtime(root, ["mismatch"]);

    const records = await setup.runtime.start();

    expect(records[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        errorCode: "CAPABILITY_DECLARATION_MISMATCH",
      }),
    );
    expect(setup.registry.list()).toHaveLength(0);
  });

  it("rejects unknown contract versions before importing the module", async () => {
    const root = await tempRoot();
    await addPlugin(
      root,
      "unknown-contract",
      manifest("unknown-contract", {
        capabilities: [{ id: "data_quality.get_trend", contractVersion: "9.0.0" }],
      }),
    );
    const setup = runtime(root, ["unknown-contract"]);

    const records = await setup.runtime.start();

    expect(records[0]).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "CONTRACT_UNKNOWN" }),
    );
  });

  it("rejects duplicate plugin IDs without importing either module", async () => {
    const root = await tempRoot();
    await addPlugin(root, "one", manifest("duplicate"));
    await addPlugin(root, "two", manifest("duplicate"));
    const setup = runtime(root, ["duplicate"]);

    const records = await setup.runtime.start();

    expect(records).toHaveLength(2);
    expect(records.every((record) => record.errorCode === "PLUGIN_ID_DUPLICATE")).toBe(true);
    expect(setup.registry.list()).toHaveLength(0);
  });

  it("does not let a later provider overwrite an existing capability binding", async () => {
    const root = await tempRoot();
    await addPlugin(root, "one", manifest("provider-one"));
    await addPlugin(root, "two", manifest("provider-two"));
    const setup = runtime(root, ["provider-one", "provider-two"]);

    const records = await setup.runtime.start();

    expect(records[0]).toEqual(expect.objectContaining({ status: "ready" }));
    expect(records[1]).toEqual(
      expect.objectContaining({ status: "failed", errorCode: "CAPABILITY_PROVIDER_CONFLICT" }),
    );
    expect(setup.registry.resolve("data_quality.get_trend", "1.0.0")?.pluginId).toBe(
      "provider-one",
    );
  });

  it("rejects unknown protocol versions and integrity mismatches", async () => {
    const root = await tempRoot();
    await addPlugin(root, "protocol", manifest("protocol", { apiVersion: "2" }));
    await addPlugin(
      root,
      "integrity",
      manifest("integrity", {
        integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      }),
    );
    const setup = runtime(root, ["protocol", "integrity"]);

    const records = await setup.runtime.start();

    expect(records.map((record) => record.errorCode).sort()).toEqual([
      "INTEGRITY_MISMATCH",
      "MANIFEST_INVALID",
    ]);
  });
});
