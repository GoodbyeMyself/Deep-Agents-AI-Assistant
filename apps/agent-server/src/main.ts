import { fileURLToPath } from "node:url";

import { createAgentRuntime, type QualityTrendExecutor } from "@assistant/agent-runtime";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

const deepSeekApiKey = process.env["DEEPSEEK_API_KEY"];
const apiKey = deepSeekApiKey ?? process.env["OPENAI_API_KEY"];
if (!apiKey) {
  throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is required for the real-model smoke test.");
}

const baseURL = process.env["DEEPSEEK_BASE_URL"];
const modelName = process.env["MODEL_NAME"] ?? (deepSeekApiKey ? "deepseek-chat" : "gpt-5-mini");

const executor: QualityTrendExecutor = {
  execute: (input, context) =>
    Promise.resolve({
      status: "success",
      data: {
        tableId: input.tableId,
        metric: "quality_score",
        unit: "percent",
        aggregation: "daily",
        timezone: "Asia/Shanghai",
        points: [{ time: "2026-10-13", value: 96 }],
      },
      evidence: [
        {
          id: "evidence-smoke-1",
          source: { type: "table", id: input.tableId },
          collectedAt: "2026-10-13T00:00:00+08:00",
          referenceId: `ref-${context.executionContextId}`,
        },
      ],
      warnings: [],
    }),
};

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const agent = createAgentRuntime({
  model: new ChatOpenAI({
    apiKey,
    model: modelName,
    temperature: 0,
    ...(baseURL === undefined ? {} : { configuration: { baseURL } }),
  }),
  executor,
  workspaceRoot: repositoryRoot,
  skills: ["/skills/"],
});

const result = await agent.invoke(
  {
    messages: [
      new HumanMessage(
        "Use data_quality_get_trend for table orders from 2026-10-07T00:00:00+08:00 to 2026-10-13T23:59:59+08:00 and summarize it.",
      ),
    ],
  },
  {
    context: { executionContextId: "smoke", contextSnapshotId: "snapshot-smoke" },
    configurable: { thread_id: "real-model-smoke" },
  },
);

const toolResult = result.messages.find(
  (message) => ToolMessage.isInstance(message) && message.name === "data_quality_get_trend",
);
if (!toolResult) {
  throw new Error("Real-model smoke test failed: the model did not call data_quality_get_trend.");
}

console.log(`Real-model Tool Calling passed with model '${modelName}'.`);
console.log(result.messages.at(-1)?.content);
