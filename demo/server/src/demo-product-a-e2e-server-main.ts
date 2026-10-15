import { startDemoProductServer } from "./demo-product-server.js";
import { createDemoTestModel } from "./demo-test-model.js";

const options = {
  pluginId: "demo-product-a",
  productName: "Product A 数据治理平台",
  defaultPort: 3411,
} as const;

await startDemoProductServer(options, createDemoTestModel(options));
