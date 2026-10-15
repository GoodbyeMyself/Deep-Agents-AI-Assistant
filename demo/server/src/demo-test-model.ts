import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";

import type { DemoModelConfiguration, DemoProductServerOptions } from "./demo-product-server.js";

export function createDemoTestModel(options: DemoProductServerOptions): DemoModelConfiguration {
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
          `${options.productName}中的${businessName}当前质量得分为 96%。这是自动化测试结论，来自当前页面上下文授权后的标准能力结果；趋势存在缺失日期，不能据此推断未返回日期的质量。`,
        ),
      );
  }
  return {
    model,
    modelConfig: {
      id: `${options.pluginId}-e2e-test-double`,
      provider: "test-double",
      model: "langchain-fake-model",
      version: "1",
    },
  };
}
