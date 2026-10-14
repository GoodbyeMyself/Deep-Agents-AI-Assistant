import { fileURLToPath } from "node:url";

import { ChatOpenAI } from "@langchain/openai";

import { createM2Application } from "./m2/bootstrap.js";
import { createNodeHttpServer } from "./m2/node-http.js";

const deepSeekKey = process.env["DEEPSEEK_API_KEY"];
const apiKey = deepSeekKey ?? process.env["OPENAI_API_KEY"];
if (apiKey === undefined) throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is required.");
const pluginId = process.env["PLUGIN_ID"] ?? "demo-product-a";
const installDir =
  process.env["PLUGINS_DIR"] ??
  fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
const baseURL = process.env["DEEPSEEK_BASE_URL"];
const modelName =
  process.env["MODEL_NAME"] ?? (deepSeekKey === undefined ? "gpt-5-mini" : "deepseek-chat");
const model = new ChatOpenAI({
  apiKey,
  model: modelName,
  temperature: 0,
  ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
});
const application = await createM2Application({
  model,
  installDir,
  approvedPluginIds: new Set([pluginId]),
  modelConfig: {
    id: "default",
    provider: deepSeekKey === undefined ? "openai" : "deepseek",
    model: modelName,
    version: "1",
  },
});
const server = createNodeHttpServer(application.handler);
const port = Number(process.env["SERVER_PORT"] ?? "3000");
server.listen(port, "127.0.0.1", () =>
  console.log(`Agent Server listening on http://127.0.0.1:${port}`),
);
