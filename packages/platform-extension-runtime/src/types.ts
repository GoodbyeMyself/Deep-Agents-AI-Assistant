import type { StructuredToolInterface } from "@langchain/core/tools";

export interface PlatformJsonObjectSchema extends Record<string, unknown> {
  readonly type: "object";
}

export interface PlatformExtensionToolManifest {
  readonly name: string;
  readonly riskLevel: "read";
  readonly requiredPermissions: readonly string[];
}

export interface PlatformExtensionSkillManifest {
  readonly id: string;
  readonly path: string;
  readonly contentDigest: string;
  readonly allowedTools: readonly string[];
}

export interface PlatformExtensionManifest {
  readonly id: string;
  readonly version: string;
  readonly apiVersion: "1";
  readonly description: string;
  readonly contributes: {
    readonly tools: readonly PlatformExtensionToolManifest[];
    readonly skills: readonly PlatformExtensionSkillManifest[];
  };
}

export interface PlatformToolInvocationContext {
  readonly signal?: AbortSignal;
}

export interface PlatformToolContribution {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: PlatformJsonObjectSchema;
  readonly execute: (
    input: Readonly<Record<string, unknown>>,
    context: PlatformToolInvocationContext,
  ) => Promise<Readonly<Record<string, unknown>>>;
}

export interface PlatformExtensionDefinition {
  readonly manifest: PlatformExtensionManifest;
  readonly rootDirectory: string;
  readonly tools: readonly PlatformToolContribution[];
}

export interface PlatformExtensionApproval {
  readonly id: string;
  readonly version: string;
  readonly manifestDigest: string;
}

export interface ApprovedPlatformExtension {
  readonly definition: PlatformExtensionDefinition;
  readonly manifestDigest: string;
}

export interface PlatformExtensionSnapshot {
  readonly approved: readonly ApprovedPlatformExtension[];
}

export interface PlatformToolAuthorizationRequest {
  readonly extensionId: string;
  readonly toolName: string;
  readonly requiredPermissions: readonly string[];
  readonly runtimeContext: unknown;
}

export type PlatformToolAuthorizer = (request: PlatformToolAuthorizationRequest) => Promise<void>;

export interface PlatformExtensionModule {
  readonly platformExtension: unknown;
}

export type PlatformExtensionModuleImporter = (
  moduleSpecifier: string,
) => Promise<PlatformExtensionModule>;

export interface ConfiguredPlatformExtension {
  readonly moduleSpecifier: string;
  readonly approval: PlatformExtensionApproval;
}

export interface PlatformExtensionRuntime {
  readonly tools: readonly StructuredToolInterface[];
  readonly workspaceRoot?: string;
  readonly skills: readonly string[];
  readonly statuses: readonly Readonly<Record<string, unknown>>[];
  close(): Promise<void>;
}
