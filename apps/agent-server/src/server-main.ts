import { fileURLToPath } from "node:url";

import { ChatOpenAI } from "@langchain/openai";
import type { PluginRuntimeRecord } from "@assistant/plugin-runtime";

import { createAgentApplication } from "./application/bootstrap.js";
import { createNodeHttpServer } from "./application/node-http.js";

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function assertApprovedPluginsReady(records: readonly PluginRuntimeRecord[]): void {
  const failed = records.filter((record) => record.status !== "ready");
  if (records.length === 0 || failed.length > 0) {
    const detail =
      failed
        .map(
          (record) =>
            `${record.pluginId ?? record.pluginPath}: ${record.errorCode ?? record.status}`,
        )
        .join("; ") || "no plugins discovered";
    throw new Error(`Approved plugins are not ready (${detail}).`);
  }
}

const deepSeekKey = envValue("DEEPSEEK_API_KEY");
const apiKey = deepSeekKey ?? envValue("OPENAI_API_KEY");
if (apiKey === undefined) throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is required.");
const pluginId = envValue("PLUGIN_ID") ?? "demo-product-a";
const installDir =
  envValue("PLUGINS_DIR") ??
  fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
const baseURL = envValue("DEEPSEEK_BASE_URL");
const modelName =
  envValue("MODEL_NAME") ?? (deepSeekKey === undefined ? "gpt-5-mini" : "deepseek-chat");
const model = new ChatOpenAI({
  apiKey,
  model: modelName,
  temperature: 0,
  maxTokens: 2_048,
  maxRetries: 1,
  timeout: 30_000,
  streamUsage: false,
  ...(deepSeekKey === undefined ? {} : { modelKwargs: { thinking: { type: "disabled" } } }),
  ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
});
const application = await createAgentApplication({
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
if (envValue("ASSISTANT_REQUIRE_READY_PLUGINS") === "1") {
  assertApprovedPluginsReady(application.pluginRecords);
}
const server = createNodeHttpServer(application.handler);
const port = Number(process.env["SERVER_PORT"] ?? "3000");
const host = process.env["SERVER_HOST"] ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("SERVER_PORT must be an integer between 1 and 65535.");
}
server.listen(port, host, () =>
  console.log(
    `Agent Server listening for deployment '${process.env["DEPLOYMENT_ID"] ?? "local"}' on http://${host}:${port}`,
  ),
);
