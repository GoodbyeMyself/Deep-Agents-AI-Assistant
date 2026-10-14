import {
  qualityTrendInputSchema,
  qualityTrendResultSchema,
  type QualityTrendInput,
  type QualityTrendResult,
} from "@assistant/capability-contracts";
import { tool, type ToolRuntime } from "langchain";

import type { RunContext } from "./context.js";

export interface QualityTrendExecutor {
  execute: (input: QualityTrendInput, context: RunContext) => Promise<QualityTrendResult>;
}

export function createQualityTrendTool(executor: QualityTrendExecutor) {
  return tool(
    async (input: QualityTrendInput, runtime: ToolRuntime<unknown, RunContext>) => {
      const result = await executor.execute(input, runtime.context);
      return qualityTrendResultSchema.parse(result);
    },
    {
      name: "data_quality_get_trend",
      description: "Get the daily quality-score trend for an authorized data table.",
      schema: qualityTrendInputSchema,
    },
  );
}
