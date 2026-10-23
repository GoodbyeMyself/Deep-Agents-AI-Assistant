import { Buffer } from "node:buffer";

import { tool, type StructuredToolInterface, type ToolRuntime } from "@langchain/core/tools";

import type { PlatformExtensionSnapshot, PlatformToolAuthorizer } from "./types.js";

const DEFAULT_MAX_RESULT_BYTES = 64 * 1024;

export class PlatformToolInvocationError extends Error {
  constructor(
    readonly code:
      | "PLATFORM_TOOL_FORBIDDEN"
      | "PLATFORM_TOOL_EXECUTION_ERROR"
      | "PLATFORM_TOOL_INVALID_RESULT"
      | "PLATFORM_TOOL_RESULT_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "PlatformToolInvocationError";
  }
}

function modelToolName(extensionId: string, toolName: string): string {
  const normalized = `platform_${extensionId}_${toolName}`.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  if (normalized.length > 128) {
    throw new Error(`Platform model Tool name is too long: '${normalized}'.`);
  }
  return normalized;
}

function resultBytes(value: unknown): number {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PlatformToolInvocationError(
      "PLATFORM_TOOL_INVALID_RESULT",
      "Platform Tool returned a non-JSON result.",
    );
  }
  if (serialized === undefined) {
    throw new PlatformToolInvocationError(
      "PLATFORM_TOOL_INVALID_RESULT",
      "Platform Tool returned a non-JSON result.",
    );
  }
  return Buffer.byteLength(serialized, "utf8");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createPermissionScopeAuthorizer(): PlatformToolAuthorizer {
  return (request) => {
    if (request.requiredPermissions.length === 0) return Promise.resolve();
    const context = request.runtimeContext;
    if (typeof context !== "object" || context === null || Array.isArray(context)) {
      return Promise.reject(
        new PlatformToolInvocationError(
          "PLATFORM_TOOL_FORBIDDEN",
          `Platform Tool '${request.extensionId}/${request.toolName}' has no trusted Runtime Context.`,
        ),
      );
    }
    const scopes = (context as Record<string, unknown>)["permissionScopes"];
    if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === "string")) {
      return Promise.reject(
        new PlatformToolInvocationError(
          "PLATFORM_TOOL_FORBIDDEN",
          `Platform Tool '${request.extensionId}/${request.toolName}' has no trusted permission scopes.`,
        ),
      );
    }
    const available = new Set(scopes);
    if (request.requiredPermissions.some((permission) => !available.has(permission))) {
      return Promise.reject(
        new PlatformToolInvocationError(
          "PLATFORM_TOOL_FORBIDDEN",
          `Platform Tool '${request.extensionId}/${request.toolName}' is not authorized.`,
        ),
      );
    }
    return Promise.resolve();
  };
}

export function createPlatformExtensionTools(options: {
  readonly snapshot: PlatformExtensionSnapshot;
  readonly authorize?: PlatformToolAuthorizer;
  readonly maxResultBytes?: number;
}): readonly StructuredToolInterface[] {
  const authorize = options.authorize ?? createPermissionScopeAuthorizer();
  const names = new Set<string>();
  return options.snapshot.approved.flatMap(({ definition }) => {
    const manifestByName = new Map(
      definition.manifest.contributes.tools.map((tool) => [tool.name, tool] as const),
    );
    return definition.tools.map((contribution) => {
      const declared = manifestByName.get(contribution.name);
      if (declared === undefined) {
        throw new Error(
          `Platform Tool '${definition.manifest.id}/${contribution.name}' is undeclared.`,
        );
      }
      const name = modelToolName(definition.manifest.id, contribution.name);
      if (names.has(name)) throw new Error(`Platform model Tool name conflict for '${name}'.`);
      names.add(name);
      const platformTool = tool(
        async (
          input: Readonly<Record<string, unknown>>,
          runtime: ToolRuntime<unknown, unknown>,
        ) => {
          await authorize({
            extensionId: definition.manifest.id,
            toolName: contribution.name,
            requiredPermissions: declared.requiredPermissions,
            runtimeContext: runtime.context,
          });
          let result: unknown;
          try {
            result = await contribution.execute(input, {
              ...(runtime.signal === undefined ? {} : { signal: runtime.signal }),
            });
          } catch {
            throw new PlatformToolInvocationError(
              "PLATFORM_TOOL_EXECUTION_ERROR",
              `Platform Tool '${definition.manifest.id}/${contribution.name}' failed.`,
            );
          }
          if (!isRecord(result)) {
            throw new PlatformToolInvocationError(
              "PLATFORM_TOOL_INVALID_RESULT",
              `Platform Tool '${definition.manifest.id}/${contribution.name}' returned a non-object result.`,
            );
          }
          if (resultBytes(result) > (options.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES)) {
            throw new PlatformToolInvocationError(
              "PLATFORM_TOOL_RESULT_TOO_LARGE",
              `Platform Tool '${definition.manifest.id}/${contribution.name}' exceeded the result size limit.`,
            );
          }
          return { ...result };
        },
        {
          name,
          description: contribution.description,
          schema: contribution.inputSchema,
        },
      );
      // The JSON object schema always selects LangChain's structured-tool overload. Its public
      // overload currently retains a DynamicTool union, so narrow only at this dependency boundary.
      return platformTool as StructuredToolInterface;
    });
  });
}
