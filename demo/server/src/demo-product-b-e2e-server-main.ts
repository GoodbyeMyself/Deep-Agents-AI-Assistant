import { startDemoProductServer } from "./demo-product-server.js";
import { createDemoTestModel } from "./demo-test-model.js";

const options = {
  pluginId: "demo-product-b",
  productName: "Product B 数据资产平台",
  defaultPort: 3412,
} as const;

await startDemoProductServer(options, createDemoTestModel(options));
