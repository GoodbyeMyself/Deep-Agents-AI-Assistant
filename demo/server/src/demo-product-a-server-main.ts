import { startDemoProductServer } from "./demo-product-server.js";

await startDemoProductServer({
  pluginId: "demo-product-a",
  productName: "Product A 数据治理平台",
  defaultPort: 3411,
});
