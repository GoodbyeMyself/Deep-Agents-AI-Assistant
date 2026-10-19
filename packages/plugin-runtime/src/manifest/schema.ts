import { z } from "zod";

const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

const capabilityDeclarationSchema = z
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

export const pluginManifestSchema = z
  .object({
    manifestVersion: z.literal("1"),
    id: identifierSchema,
    name: z.string().trim().min(1).max(120),
    version: semverSchema,
    apiVersion: z.literal("1"),
    runtime: z.discriminatedUnion("type", [localRuntimeSchema, httpRuntimeSchema]),
    capabilities: z.array(capabilityDeclarationSchema).min(1),
    integrity: z
      .string()
      .regex(/^sha256-[A-Za-z0-9+/]{43}=$/)
      .optional(),
  })
  .strict()
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
