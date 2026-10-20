import {
  type CapabilityCatalog,
  type CapabilityExecutionContext,
  type CapabilityExecutor,
  type CapabilityRegistry,
} from "@assistant/capability-core";
import { tool, type ToolRuntime } from "langchain";

import type { RunContext } from "../context/run-context.js";

function toolName(capabilityId: string): string {
  return capabilityId.replaceAll(/[^a-zA-Z0-9_]/g, "_");
}

function executionContext(context: RunContext): CapabilityExecutionContext {
  return {
    executionContextId: context.executionContextId,
    contextSnapshotId: context.contextSnapshotId,
    traceId: context.traceId ?? context.executionContextId,
    principalId: context.principalId ?? "unresolved-principal",
    ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
    ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
    ...(context.runId === undefined ? {} : { runId: context.runId }),
    ...(context.authorizationRef === undefined
      ? {}
      : { authorizationRef: context.authorizationRef }),
    ...(context.contextObjectId === undefined ? {} : { contextObjectId: context.contextObjectId }),
    authorizedObjectIds: context.authorizedObjectIds ?? [],
    permissionScopes: context.permissionScopes ?? [],
  };
}

export function createCapabilityTools(options: {
  catalog: CapabilityCatalog;
  registry: CapabilityRegistry;
  executor: CapabilityExecutor;
}) {
  const names = new Set<string>();
  return options.registry.list().map((binding) => {
    const contract = options.catalog.require(binding.capabilityId, binding.contractVersion);
    const name = toolName(contract.id);
    if (names.has(name)) throw new Error(`Capability tool name conflict for '${name}'.`);
    names.add(name);
    return tool(
      (input: unknown, runtime: ToolRuntime<unknown, RunContext>) =>
        options.executor.execute(
          contract.id,
          contract.version,
          input,
          executionContext(runtime.context),
        ),
      {
        name,
        description: contract.description,
        schema: contract.inputSchema,
      },
    );
  });
}
