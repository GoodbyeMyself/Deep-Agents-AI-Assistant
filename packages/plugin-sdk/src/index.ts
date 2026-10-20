import type {
  CapabilityContract,
  CapabilityExecutionContext,
  CapabilityProvider,
} from "@assistant/capability-core";
import type { z } from "zod";

export { defineCapability } from "@assistant/capability-core";

export const PLUGIN_API_VERSION = "1";
export const SUPPORTED_PLUGIN_API_VERSIONS = ["1", "2"] as const;

export interface PluginLogger {
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface PluginHostServices {
  readonly logger: PluginLogger;
  readonly config: Readonly<Record<string, unknown>>;
  readonly credentials: {
    getSecret(reference: string): Promise<string>;
  };
}

export interface TypedCapabilityImplementation<
  Contract extends CapabilityContract,
> extends CapabilityProvider {
  readonly id: Contract["id"];
  readonly contractVersion: Contract["version"];
  execute(
    input: z.output<Contract["inputSchema"]>,
    context: CapabilityExecutionContext,
  ): Promise<z.input<Contract["outputSchema"]>>;
}

export interface AssistantPlugin {
  /** Manifest V2 private contracts contributed by this trusted local bundle. */
  readonly contracts?: readonly CapabilityContract[];
  readonly capabilities: readonly CapabilityProvider[];
  initialize?(): Promise<void>;
  healthCheck?(): Promise<{ readonly ok: boolean; readonly details?: string }>;
  dispose?(): Promise<void>;
}

export type PluginFactory = (
  host: PluginHostServices,
) => AssistantPlugin | Promise<AssistantPlugin>;

export function definePlugin(factory: PluginFactory): PluginFactory {
  return factory;
}

export function implementCapability<Contract extends CapabilityContract>(options: {
  readonly contract: Contract;
  readonly execute: (
    input: z.output<Contract["inputSchema"]>,
    context: CapabilityExecutionContext,
  ) => Promise<z.input<Contract["outputSchema"]>>;
}): TypedCapabilityImplementation<Contract> {
  return {
    id: options.contract.id,
    contractVersion: options.contract.version,
    execute: async (input, context) => {
      const parsedInput = options.contract.inputSchema.parse(input) as z.output<
        Contract["inputSchema"]
      >;
      return options.execute(parsedInput, context);
    },
  };
}
