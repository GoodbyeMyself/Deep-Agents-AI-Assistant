import { ChatOpenAI } from "@langchain/openai";

import { createAgentApplication } from "./composition/create-application.js";
import { createNodeHttpServer } from "./http/node-http.js";

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

const deepSeekKey = envValue("DEEPSEEK_API_KEY");
const apiKey = deepSeekKey ?? envValue("OPENAI_API_KEY");
if (apiKey === undefined) throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is required.");
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
  modelConfig: {
    id: "default",
    provider: deepSeekKey === undefined ? "openai" : "deepseek",
    model: modelName,
    version: "1",
  },
});
const server = createNodeHttpServer(application.handler);
server.once("close", () => void application.dispose());
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
