import { fileURLToPath } from "node:url";

import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";

import { createM2Application } from "./m2/bootstrap.js";
import { createNodeHttpServer } from "./m2/node-http.js";

const pluginId = "demo-product-a";
const installDir = fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
const model = fakeModel()
  .respondWithTools([
    {
      name: "data_quality_get_trend",
      id: "m3-quality-1",
      args: {
        tableId: "orders",
        startTime: "2026-10-07T00:00:00+08:00",
        endTime: "2026-10-14T23:59:59+08:00",
      },
    },
  ])
  .respond(
    new AIMessage(
      "订单数据集当前质量得分为 96%，趋势稳定。结论来自已授权的数据质量能力，请查看下方证据。",
    ),
  );

const application = await createM2Application({
  model,
  installDir,
  approvedPluginIds: new Set([pluginId]),
  modelConfig: { id: "m3-demo", provider: "offline", model: "fake-model", version: "1" },
});
const server = createNodeHttpServer(application.handler);
const port = Number(process.env["SERVER_PORT"] ?? "3000");
server.listen(port, "127.0.0.1", () =>
  console.log(`M3 demo Agent Server listening on http://127.0.0.1:${port}`),
);
