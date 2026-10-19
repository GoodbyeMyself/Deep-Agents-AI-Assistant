import { fileURLToPath } from "node:url";

import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";

import {
  createAgentApplication,
  createNodeHttpServer,
} from "../../../apps/agent-server/src/index.js";

const pluginId = "demo-product-a";
const installDir = fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
let model = fakeModel();
for (const [index, tableId] of [
  "orders",
  "customers",
  "orders",
  "customers",
  "orders",
  "customers",
].entries()) {
  model = model
    .respondWithTools([
      {
        name: "data_quality_get_trend",
        id: `embed-offline-quality-${index + 1}`,
        args: {
          tableId,
          startTime: "2026-10-07T00:00:00+08:00",
          endTime: "2026-10-14T23:59:59+08:00",
        },
      },
    ])
    .respond(
      new AIMessage(
        `${tableId === "orders" ? "订单" : "客户"}数据集当前质量得分为 96%。此结论来自当前上下文授权后的标准能力结果。`,
      ),
    );
}

const application = await createAgentApplication({
  model,
  installDir,
  approvedPluginIds: new Set([pluginId]),
  modelConfig: { id: "embed-offline", provider: "offline", model: "fake-model", version: "1" },
});
const server = createNodeHttpServer(application.handler);
const port = Number(process.env["SERVER_PORT"] ?? "3000");
server.listen(port, "127.0.0.1", () =>
  console.log(`Embed offline Agent Server listening on http://127.0.0.1:${port}`),
);
