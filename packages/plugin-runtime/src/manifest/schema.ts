import { z } from "zod";

const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

const capabilityDeclarationV1Schema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
    contractVersion: semverSchema,
  })
  .strict();

const localRuntimeSchema = z
  .object({
    type: z.literal("local"),
    entry: z.string().min(1),
  })
  .strict();

const httpRuntimeSchema = z
  .object({
    type: z.literal("http"),
    baseUrl: z.url(),
  })
  .strict();

const capabilityDeclarationV2Schema = capabilityDeclarationV1Schema.extend({
  contractSource: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9@/._-]+$/),
  requiredPermission: z.string().regex(/^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/),
  riskLevel: z.enum(["read", "write", "high"]),
});

const manifestBase = {
  id: identifierSchema,
  name: z.string().trim().min(1).max(120),
  version: semverSchema,
  integrity: z
    .string()
    .regex(/^sha256-[A-Za-z0-9+/]{43}=$/)
    .optional(),
};

export const pluginManifestV1Schema = z
  .object({
    ...manifestBase,
    manifestVersion: z.literal("1"),
    apiVersion: z.literal("1"),
    runtime: z.discriminatedUnion("type", [localRuntimeSchema, httpRuntimeSchema]),
    capabilities: z.array(capabilityDeclarationV1Schema).min(1),
  })
  .strict();

export const pluginManifestV2Schema = z
  .object({
    ...manifestBase,
    manifestVersion: z.literal("2"),
    apiVersion: z.literal("2"),
    namespace: z.string().regex(/^[a-z][a-z0-9_]*$/),
    runtime: localRuntimeSchema,
    capabilities: z.array(capabilityDeclarationV2Schema).min(1),
    skills: z.array(z.string().min(1).max(300)).max(20).optional(),
  })
  .strict();

export const pluginManifestSchema = z
  .discriminatedUnion("manifestVersion", [pluginManifestV1Schema, pluginManifestV2Schema])
  .superRefine((manifest, context) => {
    const keys = new Set<string>();
    for (const [index, declaration] of manifest.capabilities.entries()) {
      const key = `${declaration.id}@${declaration.contractVersion}`;
      if (keys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", index],
          message: `Duplicate capability declaration '${key}'.`,
        });
      }
      keys.add(key);
    }
  });

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginManifestV1 = z.infer<typeof pluginManifestV1Schema>;
export type PluginManifestV2 = z.infer<typeof pluginManifestV2Schema>;
