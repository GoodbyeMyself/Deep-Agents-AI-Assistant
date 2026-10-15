import { startDemoProductServer } from "./demo-product-server.js";

await startDemoProductServer({
  pluginId: "demo-product-b",
  productName: "Product B 数据资产平台",
  defaultPort: 3412,
});
