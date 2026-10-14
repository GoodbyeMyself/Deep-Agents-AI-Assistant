import { runStandardCapabilityContractSuite } from "@assistant/capability-contract-testkit";

import pluginFactory from "./index.js";

runStandardCapabilityContractSuite("demo-product-a", pluginFactory);
