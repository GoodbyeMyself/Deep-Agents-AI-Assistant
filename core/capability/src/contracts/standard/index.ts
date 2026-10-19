export {
  dataMapObjectSchema,
  dataMapSearchObjectsDataSchema,
  dataMapSearchObjectsInputSchema,
  dataMapSearchObjectsResultSchema,
  dataMapSearchObjectsV1,
  type DataMapSearchObjectsData,
  type DataMapSearchObjectsInput,
  type DataMapSearchObjectsResult,
} from "./data-map-search-objects.js";
export {
  qualityTrendDataSchema,
  qualityTrendInputSchema,
  qualityTrendResultSchema,
  qualityTrendV1,
  type QualityTrendData,
  type QualityTrendInput,
  type QualityTrendResult,
} from "./quality-trend.js";

import { dataMapSearchObjectsV1 } from "./data-map-search-objects.js";
import { qualityTrendV1 } from "./quality-trend.js";

export type KnownCapabilityContract = typeof dataMapSearchObjectsV1 | typeof qualityTrendV1;

export const standardCapabilityContracts = [
  dataMapSearchObjectsV1,
  qualityTrendV1,
] as const satisfies readonly KnownCapabilityContract[];
