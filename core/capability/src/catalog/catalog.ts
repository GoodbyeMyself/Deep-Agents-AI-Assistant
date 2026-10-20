import {
  capabilityKey,
  standardCapabilityContracts,
  type CapabilityContract,
} from "../contracts/index.js";
import { z } from "zod";

const capabilityIdPattern = /^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$/;
const privateNamespacePattern = /^[a-z][a-z0-9_]*$/;
const pluginIdentifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const permissionPattern = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.-]*$/;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const RESERVED_CAPABILITY_NAMESPACES = ["data_map", "data_quality"] as const;

export interface PlatformCapabilitySource {
  readonly type: "platform";
  readonly id: string;
}

export interface PluginCapabilitySource {
  readonly type: "plugin";
  readonly id: string;
  readonly namespace: string;
}

export type CapabilityContractSource = PlatformCapabilitySource | PluginCapabilitySource;

export interface CapabilityContractRegistration {
  readonly contract: CapabilityContract;
  readonly source: CapabilityContractSource;
}

export const STANDARD_CAPABILITY_SOURCE = {
  type: "platform",
  id: "@assistant/capability-contracts",
} as const satisfies PlatformCapabilitySource;

const capabilitySourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("platform"),
      id: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9@/._-]+$/),
    })
    .strict(),
  z
    .object({
      type: z.literal("plugin"),
      id: z.string().regex(pluginIdentifierPattern),
      namespace: z.string().regex(privateNamespacePattern),
    })
    .strict(),
]);

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}

function validateContract(contract: CapabilityContract, source: CapabilityContractSource): void {
  if (!capabilityIdPattern.test(contract.id)) {
    throw new Error(`Invalid capability id '${contract.id}'.`);
  }
  if (!semverPattern.test(contract.version)) {
    throw new Error(`Invalid capability version '${contract.version}'.`);
  }
  if (contract.description.trim().length === 0 || contract.description.length > 1_000) {
    throw new Error(`Invalid capability description for '${contract.id}'.`);
  }
  if (!permissionPattern.test(contract.requiredPermission)) {
    throw new Error(`Invalid capability permission '${contract.requiredPermission}'.`);
  }
  if (!(["read", "write", "high"] as const).includes(contract.riskLevel)) {
    throw new Error(`Invalid capability risk level for '${contract.id}'.`);
  }
  if (!isZodSchema(contract.inputSchema) || !isZodSchema(contract.outputSchema)) {
    throw new Error(`Capability '${contract.id}' must use Zod input and output schemas.`);
  }

  if (source.type !== "plugin") return;
  if ((RESERVED_CAPABILITY_NAMESPACES as readonly string[]).includes(source.namespace)) {
    throw new Error(`Namespace '${source.namespace}' is reserved for platform capabilities.`);
  }
  const segments = contract.id.split(".");
  if (segments.length < 3 || segments[0] !== source.namespace) {
    throw new Error(
      `Private capability '${contract.id}' must use the approved '${source.namespace}' namespace.`,
    );
  }
  if (contract.riskLevel !== "read") {
    throw new Error(`Private dynamic capability '${contract.id}' must be read-only.`);
  }
}

export class CapabilityCatalog {
  readonly #registrations = new Map<string, CapabilityContractRegistration>();

  constructor(contracts: readonly CapabilityContract[] = standardCapabilityContracts) {
    this.registerMany(contracts, STANDARD_CAPABILITY_SOURCE);
  }

  register(contract: CapabilityContract, source: CapabilityContractSource): void {
    this.registerMany([contract], source);
  }

  registerMany(
    contracts: readonly CapabilityContract[],
    source: CapabilityContractSource,
  ): void {
    const parsedSource = capabilitySourceSchema.parse(source) as CapabilityContractSource;
    const staged = new Map<string, CapabilityContractRegistration>();
    for (const contract of contracts) {
      validateContract(contract, parsedSource);
      const key = capabilityKey(contract.id, contract.version);
      if (staged.has(key) || this.#registrations.has(key)) {
        throw new Error(`Duplicate capability contract '${key}'.`);
      }
      staged.set(key, {
        contract,
        source: Object.freeze({ ...parsedSource }),
      });
    }
    for (const [key, registration] of staged) this.#registrations.set(key, registration);
  }

  get(id: string, version: string): CapabilityContract | undefined {
    return this.getRegistration(id, version)?.contract;
  }

  getRegistration(id: string, version: string): CapabilityContractRegistration | undefined {
    return this.#registrations.get(capabilityKey(id, version));
  }

  require(id: string, version: string): CapabilityContract {
    const contract = this.get(id, version);
    if (!contract) throw new Error(`Unknown capability contract '${capabilityKey(id, version)}'.`);
    return contract;
  }

  list(): readonly CapabilityContract[] {
    return this.listRegistrations().map((registration) => registration.contract);
  }

  listRegistrations(): readonly CapabilityContractRegistration[] {
    return [...this.#registrations.values()];
  }
}

export function createStandardCapabilityCatalog(): CapabilityCatalog {
  return new CapabilityCatalog();
}
