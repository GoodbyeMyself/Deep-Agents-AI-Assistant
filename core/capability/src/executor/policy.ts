import type { CapabilityErrorCode } from "../contracts/index.js";
import type { CapabilityExecutionContext } from "../registry/registry.js";

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

export const noOpCapabilityAuditSink: CapabilityAuditSink = { write: () => Promise.resolve() };
