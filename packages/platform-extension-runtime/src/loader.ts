import { z } from "zod";

import { createApprovedPlatformExtensionSnapshot } from "./approval.js";
import { createPlatformSkillSnapshot } from "./skill-snapshot.js";
import { createPlatformExtensionTools } from "./tool-factory.js";
import type {
  ConfiguredPlatformExtension,
  PlatformExtensionModuleImporter,
  PlatformExtensionRuntime,
} from "./types.js";

const moduleSpecifierSchema = z
  .string()
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const configuredExtensionsSchema = z.array(
  z
    .object({
      moduleSpecifier: moduleSpecifierSchema,
      approval: z
        .object({
          id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
          version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
          manifestDigest: digestSchema,
        })
        .strict(),
    })
    .strict(),
);

const defaultImporter: PlatformExtensionModuleImporter = async (moduleSpecifier) =>
  (await import(moduleSpecifier)) as PlatformExtensionModuleImporter extends (
    moduleSpecifier: string,
  ) => Promise<infer Module>
    ? Module
    : never;

export function readPlatformExtensionDeploymentConfig(
  environment: NodeJS.ProcessEnv,
): readonly ConfiguredPlatformExtension[] | undefined {
  const raw = environment["PLATFORM_EXTENSIONS"]?.trim();
  if (raw === undefined || raw.length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PLATFORM_EXTENSIONS must be valid JSON.");
  }
  const configured = configuredExtensionsSchema.parse(parsed);
  const moduleSpecifiers = new Set<string>();
  const extensionIds = new Set<string>();
  for (const item of configured) {
    if (moduleSpecifiers.has(item.moduleSpecifier)) {
      throw new Error(`Duplicate Platform Extension module '${item.moduleSpecifier}'.`);
    }
    if (extensionIds.has(item.approval.id)) {
      throw new Error(`Duplicate Platform Extension approval '${item.approval.id}'.`);
    }
    moduleSpecifiers.add(item.moduleSpecifier);
    extensionIds.add(item.approval.id);
  }
  return Object.freeze(configured);
}

export async function loadApprovedPlatformExtensions(
  configured: readonly ConfiguredPlatformExtension[],
  importer: PlatformExtensionModuleImporter = defaultImporter,
): Promise<PlatformExtensionRuntime> {
  const modules = await Promise.all(
    configured.map(async (item) => {
      moduleSpecifierSchema.parse(item.moduleSpecifier);
      return importer(item.moduleSpecifier);
    }),
  );
  const snapshot = createApprovedPlatformExtensionSnapshot(
    modules.map((module) => module.platformExtension),
    configured.map((item) => item.approval),
  );
  const tools = Object.freeze(createPlatformExtensionTools({ snapshot }));
  const skillSnapshot = await createPlatformSkillSnapshot(snapshot);
  const statuses = Object.freeze(
    snapshot.approved.map(({ definition, manifestDigest }) =>
      Object.freeze({
        id: definition.manifest.id,
        version: definition.manifest.version,
        manifestDigest,
        toolCount: definition.manifest.contributes.tools.length,
        skillCount: definition.manifest.contributes.skills.length,
        status: "approved",
      }),
    ),
  );
  return Object.freeze({
    tools,
    skills: skillSnapshot.skills,
    statuses,
    ...(skillSnapshot.workspaceRoot === undefined
      ? {}
      : { workspaceRoot: skillSnapshot.workspaceRoot }),
    close: () => skillSnapshot.close(),
  });
}
