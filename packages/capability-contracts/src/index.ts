/** @deprecated Import generic APIs from @assistant/capability-core and domain contracts directly. */
export * from "@assistant/capability-core";
export * from "@assistant/capability-data-map";
export * from "@assistant/capability-data-quality";

import { CapabilityCatalog } from "@assistant/capability-core";
import {
  DATA_MAP_CAPABILITY_SOURCE,
  dataMapCapabilityContracts,
} from "@assistant/capability-data-map";
import {
  DATA_QUALITY_CAPABILITY_SOURCE,
  dataQualityCapabilityContracts,
} from "@assistant/capability-data-quality";

export const standardCapabilityContracts = [
  ...dataMapCapabilityContracts,
  ...dataQualityCapabilityContracts,
] as const;

export type KnownCapabilityContract = (typeof standardCapabilityContracts)[number];

/** @deprecated Compose a CapabilityCatalog from domain packages at the application boundary. */
export function createStandardCapabilityCatalog(): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  catalog.registerMany(dataMapCapabilityContracts, DATA_MAP_CAPABILITY_SOURCE);
  catalog.registerMany(dataQualityCapabilityContracts, DATA_QUALITY_CAPABILITY_SOURCE);
  return catalog;
}
