import { ZodError } from "zod";

import type { CapabilityCatalog } from "./catalog.js";
import type { CapabilityErrorCode } from "./contracts.js";
import type { CapabilityExecutionContext, CapabilityRegistry } from "./registry.js";

export interface CapabilityPolicy {
  authorize(request: {
    readonly capabilityId: string;
    readonly contractVersion: string;
    readonly requiredPermission: string;
    readonly context: CapabilityExecutionContext;
    readonly input: unknown;
  }): Promise<boolean>;
}

export interface CapabilityAuditRecord {
  readonly traceId: string;
  readonly executionContextId: string;
  readonly principalId: string;
  readonly tenantId?: string;
  readonly sessionId?: string;
  readonly runId?: string;
  readonly capabilityId: string;
  readonly contractVersion: string;
  readonly pluginId?: string;
  readonly outcome: "success" | "partial" | "denied" | "error";
  readonly errorCode?: CapabilityErrorCode;
  readonly evidenceRefs: readonly string[];
}

export interface CapabilityAuditSink {
  write(record: CapabilityAuditRecord): Promise<void>;
}

export const scopeCapabilityPolicy: CapabilityPolicy = {
  authorize: ({ requiredPermission, context }) =>
    Promise.resolve(context.permissionScopes.includes(requiredPermission)),
};

const noOpAuditSink: CapabilityAuditSink = { write: () => Promise.resolve() };

function errorResult(code: CapabilityErrorCode, message: string, retryable = false) {
  return {
    status: "error" as const,
    data: null,
    evidence: [],
    warnings: [],
    error: { code, message, retryable },
  };
}

export class CapabilityExecutor {
  readonly #catalog: CapabilityCatalog;
  readonly #registry: CapabilityRegistry;
  readonly #policy: CapabilityPolicy;
  readonly #audit: CapabilityAuditSink;

  constructor(options: {
    catalog: CapabilityCatalog;
    registry: CapabilityRegistry;
    policy?: CapabilityPolicy;
    audit?: CapabilityAuditSink;
  }) {
    this.#catalog = options.catalog;
    this.#registry = options.registry;
    this.#policy = options.policy ?? scopeCapabilityPolicy;
    this.#audit = options.audit ?? noOpAuditSink;
  }

  async execute(
    capabilityId: string,
    contractVersion: string,
    input: unknown,
    context: CapabilityExecutionContext,
  ): Promise<unknown> {
    const contract = this.#catalog.require(capabilityId, contractVersion);
    const binding = this.#registry.resolve(capabilityId, contractVersion);
    const baseAudit = {
      traceId: context.traceId,
      executionContextId: context.executionContextId,
      principalId: context.principalId,
      ...(context.tenantId === undefined ? {} : { tenantId: context.tenantId }),
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      ...(context.runId === undefined ? {} : { runId: context.runId }),
      capabilityId,
      contractVersion,
    };

    const parsedInput = contract.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      const result = contract.outputSchema.parse(
        errorResult("INVALID_INPUT", "Capability input does not satisfy the standard contract."),
      );
      await this.#audit.write({
        ...baseAudit,
        outcome: "error",
        errorCode: "INVALID_INPUT",
        evidenceRefs: [],
      });
      return result;
    }

    const allowed = await this.#policy.authorize({
      capabilityId,
      contractVersion,
      requiredPermission: contract.requiredPermission,
      context,
      input: parsedInput.data,
    });
    if (!allowed) {
      const result = contract.outputSchema.parse(
        errorResult("FORBIDDEN", "The current principal is not authorized for this capability."),
      );
      await this.#audit.write({
        ...baseAudit,
        ...(binding === undefined ? {} : { pluginId: binding.pluginId }),
        outcome: "denied",
        errorCode: "FORBIDDEN",
        evidenceRefs: [],
      });
      return result;
    }

    if (!binding) {
      const result = contract.outputSchema.parse(
        errorResult("PROVIDER_UNAVAILABLE", "No provider is installed for this capability.", true),
      );
      await this.#audit.write({
        ...baseAudit,
        outcome: "error",
        errorCode: "PROVIDER_UNAVAILABLE",
        evidenceRefs: [],
      });
      return result;
    }

    try {
      const rawResult = await binding.provider.execute(parsedInput.data, context);
      const result = contract.outputSchema.parse(rawResult) as {
        status: "success" | "partial" | "error";
        evidence: Array<{ referenceId: string }>;
        error?: { code: CapabilityErrorCode };
      };
      await this.#audit.write({
        ...baseAudit,
        pluginId: binding.pluginId,
        outcome: result.status === "error" ? "error" : result.status,
        ...(result.error === undefined ? {} : { errorCode: result.error.code }),
        evidenceRefs: result.evidence.map((evidence) => evidence.referenceId),
      });
      return result;
    } catch (error) {
      const schemaMismatch = error instanceof ZodError;
      const code: CapabilityErrorCode = schemaMismatch ? "SCHEMA_MISMATCH" : "UPSTREAM_ERROR";
      const result = contract.outputSchema.parse(
        errorResult(
          code,
          schemaMismatch
            ? "Provider output does not satisfy the standard contract."
            : "The capability provider failed.",
          !schemaMismatch,
        ),
      );
      await this.#audit.write({
        ...baseAudit,
        pluginId: binding.pluginId,
        outcome: "error",
        errorCode: code,
        evidenceRefs: [],
      });
      return result;
    }
  }
}
