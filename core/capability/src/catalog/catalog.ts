import {
  capabilityKey,
  standardCapabilityContracts,
  type CapabilityContract,
} from "../contracts/index.js";

export class CapabilityCatalog {
  readonly #contracts = new Map<string, CapabilityContract>();

  constructor(contracts: readonly CapabilityContract[] = standardCapabilityContracts) {
    for (const contract of contracts) {
      const key = capabilityKey(contract.id, contract.version);
      if (this.#contracts.has(key)) throw new Error(`Duplicate capability contract '${key}'.`);
      this.#contracts.set(key, contract);
    }
  }

  get(id: string, version: string): CapabilityContract | undefined {
    return this.#contracts.get(capabilityKey(id, version));
  }

  require(id: string, version: string): CapabilityContract {
    const contract = this.get(id, version);
    if (!contract) throw new Error(`Unknown capability contract '${capabilityKey(id, version)}'.`);
    return contract;
  }

  list(): readonly CapabilityContract[] {
    return [...this.#contracts.values()];
  }
}

export function createStandardCapabilityCatalog(): CapabilityCatalog {
  return new CapabilityCatalog();
}
