import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ChatOpenAI } from "@langchain/openai";

import { createAgentApplication } from "../../../apps/agent-server/src/application/bootstrap.js";
import { createNodeHttpServer } from "../../../apps/agent-server/src/application/node-http.js";

export interface DemoProductServerOptions {
  readonly pluginId: "demo-product-a" | "demo-product-b";
  readonly productName: string;
  readonly defaultPort: number;
}

export interface DemoModelConfiguration {
  readonly model: BaseLanguageModel;
  readonly modelConfig: {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly version: string;
  };
}

function configuredModel(options: DemoProductServerOptions) {
  const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const deepSeekApiKey = process.env["DEEPSEEK_API_KEY"]?.trim() || undefined;
  if (deepSeekApiKey === undefined) {
    throw new Error(
      "The interactive demo requires DEEPSEEK_API_KEY in the repository root .env file.",
    );
  }
  const modelName = process.env["MODEL_NAME"]?.trim() || "deepseek-chat";
  const baseURL = process.env["DEEPSEEK_BASE_URL"]?.trim() || undefined;
  return {
    model: new ChatOpenAI({
      apiKey: deepSeekApiKey,
      model: modelName,
      temperature: 0,
      maxTokens: 2_048,
      maxRetries: 1,
      timeout: 30_000,
      streamUsage: false,
      modelKwargs: { thinking: { type: "disabled" } },
      ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
    }),
    modelConfig: {
      id: `${options.pluginId}-deepseek`,
      provider: "deepseek",
      model: modelName,
      version: "1",
    },
  };
}

export async function startDemoProductServer(
  options: DemoProductServerOptions,
  modelOverride?: DemoModelConfiguration,
) {
  const installDir = fileURLToPath(
    new URL(`../../../adapters/${options.pluginId}/`, import.meta.url),
  );
  const { model, modelConfig } = modelOverride ?? configuredModel(options);

  const application = await createAgentApplication({
    model,
    installDir,
    approvedPluginIds: new Set([options.pluginId]),
    modelConfig,
  });
  const server = createNodeHttpServer(application.handler);
  const port = Number(process.env["SERVER_PORT"] ?? String(options.defaultPort));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SERVER_PORT must be an integer between 1 and 65535.");
  }
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `${options.productName} demo listening on http://127.0.0.1:${port} (${modelConfig.provider}/${modelConfig.model})`,
    );
  });
  return { application, server };
}
