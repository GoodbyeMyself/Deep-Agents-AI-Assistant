import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { ChatOpenAI } from "@langchain/openai";

import { createM2Application } from "../../../apps/agent-server/src/m2/bootstrap.js";
import { createNodeHttpServer } from "../../../apps/agent-server/src/m2/node-http.js";

export interface DemoProductServerOptions {
  readonly pluginId: "demo-product-a" | "demo-product-b";
  readonly productName: string;
  readonly defaultPort: number;
}

function offlineModel(options: DemoProductServerOptions) {
  let model = fakeModel();
  for (const [index, tableId] of Array.from({ length: 12 }, (_, itemIndex) =>
    itemIndex % 2 === 0 ? "orders" : "customers",
  ).entries()) {
    const businessName = tableId === "orders" ? "订单数据" : "客户数据";
    model = model
      .respondWithTools([
        {
          name: "data_quality_get_trend",
          id: `${options.pluginId}-quality-${index + 1}`,
          args: {
            tableId,
            startTime: "2026-10-07T00:00:00+08:00",
            endTime: "2026-10-14T23:59:59+08:00",
          },
        },
      ])
      .respond(
        new AIMessage(
          `${options.productName}中的${businessName}当前质量得分为 96%。这是离线演示结论，来自当前页面上下文授权后的标准能力结果；趋势存在缺失日期，不能据此推断未返回日期的质量。`,
        ),
      );
  }
  return model;
}

function configuredModel(options: DemoProductServerOptions) {
  const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const requestedMode = process.env["DEMO_MODEL_MODE"] ?? "auto";
  if (!new Set(["auto", "real", "fake"]).has(requestedMode)) {
    throw new Error("DEMO_MODEL_MODE must be 'auto', 'real', or 'fake'.");
  }
  const deepSeekApiKey = process.env["DEEPSEEK_API_KEY"];
  const openAiApiKey = process.env["OPENAI_API_KEY"];
  const apiKey = deepSeekApiKey ?? openAiApiKey;
  const useRealModel =
    requestedMode === "real" || (requestedMode === "auto" && apiKey !== undefined);
  if (!useRealModel) {
    return {
      model: offlineModel(options),
      modelConfig: {
        id: `${options.pluginId}-offline-demo`,
        provider: "offline",
        model: "langchain-fake-model",
        version: "1",
      },
    };
  }
  if (!apiKey) {
    throw new Error("DEMO_MODEL_MODE=real requires DEEPSEEK_API_KEY or OPENAI_API_KEY.");
  }
  const modelName = process.env["MODEL_NAME"] ?? (deepSeekApiKey ? "deepseek-chat" : "gpt-5-mini");
  const baseURL = process.env["DEEPSEEK_BASE_URL"];
  const provider = deepSeekApiKey ? "deepseek" : "openai-compatible";
  return {
    model: new ChatOpenAI({
      apiKey,
      model: modelName,
      temperature: 0,
      ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
    }),
    modelConfig: {
      id: `${options.pluginId}-${provider}`,
      provider,
      model: modelName,
      version: "1",
    },
  };
}

export async function startDemoProductServer(options: DemoProductServerOptions) {
  const installDir = fileURLToPath(
    new URL(`../../../adapters/${options.pluginId}/`, import.meta.url),
  );
  const { model, modelConfig } = configuredModel(options);

  const application = await createM2Application({
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
