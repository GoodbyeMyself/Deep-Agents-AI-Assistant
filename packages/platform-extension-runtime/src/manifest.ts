import { createHash } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import type {
  PlatformExtensionDefinition,
  PlatformExtensionManifest,
  PlatformJsonObjectSchema,
} from "./types.js";

const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/);
const toolNameSchema = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const permissionSchema = z.string().regex(/^platform:[a-z0-9][a-z0-9:_-]{1,95}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const manifestSchema = z
  .object({
    id: identifierSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    apiVersion: z.literal("1"),
    description: z.string().min(1).max(500),
    contributes: z
      .object({
        tools: z.array(
          z
            .object({
              name: toolNameSchema,
              riskLevel: z.literal("read"),
              requiredPermissions: z.array(permissionSchema).max(32),
            })
            .strict(),
        ),
        skills: z.array(
          z
            .object({
              id: identifierSchema,
              path: z.string().min(1).max(240),
              contentDigest: digestSchema,
              allowedTools: z.array(z.string().min(1).max(128)).max(64),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Extension manifest contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Extension manifest contains a non-JSON value of type '${typeof value}'.`);
}

function requireObjectSchema(value: unknown, label: string): PlatformJsonObjectSchema {
  if (!isRecord(value) || value["type"] !== "object") {
    throw new Error(`${label} must be an object JSON Schema.`);
  }
  canonicalJson(value);
  return value as PlatformJsonObjectSchema;
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label} '${value}'.`);
    seen.add(value);
  }
}

function validateSkillPath(rootDirectory: string, skillPath: string, skillId: string): void {
  if (path.isAbsolute(skillPath)) {
    throw new Error(`Platform Skill '${skillId}' path must be relative.`);
  }
  const root = path.resolve(rootDirectory);
  const resolved = path.resolve(root, skillPath);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Platform Skill '${skillId}' path escapes its extension root.`);
  }
}

export function parsePlatformExtensionDefinition(value: unknown): PlatformExtensionDefinition {
  if (!isRecord(value)) throw new Error("Platform extension export must be an object.");
  const manifest = manifestSchema.parse(value["manifest"]) as PlatformExtensionManifest;
  const rootDirectory = value["rootDirectory"];
  const tools = value["tools"];
  if (typeof rootDirectory !== "string" || !path.isAbsolute(rootDirectory)) {
    throw new Error(`Platform extension '${manifest.id}' rootDirectory must be absolute.`);
  }
  if (!Array.isArray(tools)) {
    throw new Error(`Platform extension '${manifest.id}' tools must be an array.`);
  }
  const toolValues: readonly unknown[] = tools;

  assertUnique(
    manifest.contributes.tools.map((tool) => tool.name),
    "Platform Tool manifest",
  );
  assertUnique(
    manifest.contributes.skills.map((skill) => skill.id),
    "Platform Skill manifest",
  );
  const declaredModelToolNames = new Set(
    manifest.contributes.tools.map((tool) =>
      `platform_${manifest.id}_${tool.name}`.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
    ),
  );
  for (const skill of manifest.contributes.skills) {
    for (const allowedTool of skill.allowedTools) {
      if (!declaredModelToolNames.has(allowedTool)) {
        throw new Error(
          `Platform Skill '${skill.id}' references undeclared Tool '${allowedTool}'.`,
        );
      }
    }
  }
  const implementationByName = new Map<string, PlatformExtensionDefinition["tools"][number]>();
  const validatedTools: PlatformExtensionDefinition["tools"][number][] = [];
  for (const tool of toolValues) {
    if (!isRecord(tool) || typeof tool["name"] !== "string") {
      throw new Error(`Platform extension '${manifest.id}' has an invalid Tool implementation.`);
    }
    if (implementationByName.has(tool["name"])) {
      throw new Error(`Duplicate Platform Tool implementation '${tool["name"]}'.`);
    }
    if (typeof tool["description"] !== "string" || tool["description"].length > 1_000) {
      throw new Error(`Platform Tool '${tool["name"]}' has an invalid description.`);
    }
    requireObjectSchema(tool["inputSchema"], `Platform Tool '${tool["name"]}' inputSchema`);
    if (typeof tool["execute"] !== "function") {
      throw new Error(`Platform Tool '${tool["name"]}' execute must be a function.`);
    }
    const validatedTool = tool as unknown as PlatformExtensionDefinition["tools"][number];
    implementationByName.set(tool["name"], validatedTool);
    validatedTools.push(validatedTool);
  }

  for (const declared of manifest.contributes.tools) {
    if (!implementationByName.delete(declared.name)) {
      throw new Error(`Platform Tool '${declared.name}' is declared but not implemented.`);
    }
  }
  if (implementationByName.size > 0) {
    throw new Error(
      `Undeclared Platform Tool implementation '${implementationByName.keys().next().value}'.`,
    );
  }
  for (const skill of manifest.contributes.skills) {
    validateSkillPath(rootDirectory, skill.path, skill.id);
  }

  return Object.freeze({
    manifest,
    rootDirectory: path.resolve(rootDirectory),
    tools: Object.freeze(validatedTools),
  });
}

export function createPlatformExtensionManifestDigest(manifest: PlatformExtensionManifest): string {
  const parsed = manifestSchema.parse(manifest);
  return createHash("sha256").update(canonicalJson(parsed), "utf8").digest("hex");
}
