import assert from "node:assert/strict";
import test from "node:test";

import { platformExtension as diagnosticsExtension } from "../../packages/platform-diagnostics-extension/dist/index.js";
import {
  PlatformToolInvocationError,
  createApprovedPlatformExtensionSnapshot,
  createPlatformExtensionManifestDigest,
  createPlatformExtensionTools,
  loadApprovedPlatformExtensions,
  readPlatformExtensionDeploymentConfig,
} from "../../packages/platform-extension-runtime/dist/index.js";

function approvalFor(extension = diagnosticsExtension) {
  return {
    id: extension.manifest.id,
    version: extension.manifest.version,
    manifestDigest: createPlatformExtensionManifestDigest(extension.manifest),
  };
}

test("exact manifest approvals create an immutable extension snapshot", () => {
  const approval = approvalFor();
  const snapshot = createApprovedPlatformExtensionSnapshot([diagnosticsExtension], [approval]);
  assert.equal(snapshot.approved.length, 1);
  assert.equal(snapshot.approved[0]?.definition.manifest.id, "platform-diagnostics");
  assert.throws(
    () =>
      createApprovedPlatformExtensionSnapshot(
        [diagnosticsExtension],
        [{ ...approval, manifestDigest: "0".repeat(64) }],
      ),
    /approval drift/,
  );
});

test("platform Tool execution uses a namespaced model name and JSON result", async () => {
  const snapshot = createApprovedPlatformExtensionSnapshot([diagnosticsExtension], [approvalFor()]);
  const tools = createPlatformExtensionTools({ snapshot });
  assert.equal(tools[0]?.name, "platform_platform-diagnostics_extension_boundary");
  const result = await tools[0]?.invoke({});
  assert.equal(result.status, "success");
  assert.match(result.businessCapabilitiesMustUse, /system MCP/);
});

test("permission-bound Platform Tools fail closed without trusted scopes", async () => {
  const protectedExtension = {
    ...diagnosticsExtension,
    manifest: {
      ...diagnosticsExtension.manifest,
      id: "protected-platform-extension",
      contributes: {
        ...diagnosticsExtension.manifest.contributes,
        tools: [
          {
            name: "extension_boundary",
            riskLevel: "read",
            requiredPermissions: ["platform:diagnostics:read"],
          },
        ],
        skills: [],
      },
    },
  };
  const snapshot = createApprovedPlatformExtensionSnapshot(
    [protectedExtension],
    [approvalFor(protectedExtension)],
  );
  const tools = createPlatformExtensionTools({ snapshot });
  await assert.rejects(
    () => tools[0]?.invoke({}),
    (error) =>
      error instanceof PlatformToolInvocationError && error.code === "PLATFORM_TOOL_FORBIDDEN",
  );
  const result = await tools[0]?.invoke(
    {},
    { context: { permissionScopes: ["platform:diagnostics:read"] } },
  );
  assert.equal(result.status, "success");
});

test("Platform Tool implementation errors are sanitized before reaching the model", async () => {
  const failingExtension = {
    ...diagnosticsExtension,
    manifest: {
      ...diagnosticsExtension.manifest,
      id: "failing-platform-extension",
      contributes: { ...diagnosticsExtension.manifest.contributes, skills: [] },
    },
    tools: [
      {
        ...diagnosticsExtension.tools[0],
        execute: async () => {
          throw new Error("secret-token=do-not-leak");
        },
      },
    ],
  };
  const snapshot = createApprovedPlatformExtensionSnapshot(
    [failingExtension],
    [approvalFor(failingExtension)],
  );
  const tools = createPlatformExtensionTools({ snapshot });
  await assert.rejects(
    () => tools[0]?.invoke({}),
    (error) =>
      error instanceof PlatformToolInvocationError &&
      error.code === "PLATFORM_TOOL_EXECUTION_ERROR" &&
      !error.message.includes("secret-token"),
  );
});

test("loader rejects path and URL module specifiers before importing code", async () => {
  for (const moduleSpecifier of [
    "../extension.js",
    "file:///extension.js",
    "https://example.com/x.js",
  ]) {
    const configured = [{ moduleSpecifier, approval: approvalFor() }];
    let importCalled = false;
    await assert.rejects(
      () =>
        loadApprovedPlatformExtensions(configured, async () => {
          importCalled = true;
          return { platformExtension: diagnosticsExtension };
        }),
      /Invalid string|expected string to match|regular expression/i,
    );
    assert.equal(importCalled, false);
  }
});

test("approved Skills are hashed and copied into an isolated startup snapshot", async () => {
  const approval = approvalFor();
  const configured = [{ moduleSpecifier: "trusted-extension", approval }];
  const runtime = await loadApprovedPlatformExtensions(configured, async () => ({
    platformExtension: diagnosticsExtension,
  }));
  try {
    assert.match(runtime.workspaceRoot ?? "", /assistant-platform-extensions-/);
    assert.deepEqual(runtime.skills, ["/skills/platform-diagnostics__platform-extension-help"]);
    assert.equal(runtime.statuses[0]?.status, "approved");
  } finally {
    await runtime.close();
  }
});

test("Skill content drift rejects the complete extension startup", async () => {
  const driftedExtension = {
    ...diagnosticsExtension,
    manifest: {
      ...diagnosticsExtension.manifest,
      contributes: {
        ...diagnosticsExtension.manifest.contributes,
        skills: diagnosticsExtension.manifest.contributes.skills.map((skill) => ({
          ...skill,
          contentDigest: "0".repeat(64),
        })),
      },
    },
  };
  const configured = [
    { moduleSpecifier: "trusted-extension", approval: approvalFor(driftedExtension) },
  ];
  await assert.rejects(
    () =>
      loadApprovedPlatformExtensions(configured, async () => ({
        platformExtension: driftedExtension,
      })),
    /Skill content drift/,
  );
});

test("deployment configuration requires an exact installed package approval", () => {
  const approval = approvalFor();
  const config = readPlatformExtensionDeploymentConfig({
    PLATFORM_EXTENSIONS: JSON.stringify([
      { moduleSpecifier: "@assistant/platform-diagnostics-extension", approval },
    ]),
  });
  assert.equal(config?.[0]?.approval.id, "platform-diagnostics");
  assert.throws(
    () =>
      readPlatformExtensionDeploymentConfig({
        PLATFORM_EXTENSIONS: JSON.stringify([
          { moduleSpecifier: "file:///tmp/extension.js", approval },
        ]),
      }),
    /Invalid string|expected string to match|regular expression/i,
  );
});
