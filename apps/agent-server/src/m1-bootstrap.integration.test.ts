import { fileURLToPath } from "node:url";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { describe, expect, it } from "vitest";

import { createAgentFromInstalledPlugins } from "./m1-bootstrap.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function installDirectory(pluginId: "demo-product-a" | "demo-product-b"): string {
  return fileURLToPath(new URL(`../../../adapters/${pluginId}/`, import.meta.url));
}

function modelForQualityTool() {
  return fakeModel()
    .respondWithTools([
      {
        name: "data_quality_get_trend",
        id: "m1-quality-call",
        args: {
          tableId: "orders",
          startTime: "2026-10-14T00:00:00+08:00",
          endTime: "2026-10-14T23:59:59+08:00",
        },
      },
    ])
    .respond(new AIMessage("The verified quality score is 96 percent."));
}

describe("M1 installed plugin composition", () => {
  for (const pluginId of ["demo-product-a", "demo-product-b"] as const) {
    it(`discovers ${pluginId} after restart and exposes the same standard tools`, async () => {
      expect(repositoryRoot).toContain("Deep-Agents-AI-Assistant");
      const boot = await createAgentFromInstalledPlugins({
        model: modelForQualityTool(),
        installDir: installDirectory(pluginId),
        approvedPluginIds: new Set([pluginId]),
      });

      expect(boot.pluginRecords).toEqual([expect.objectContaining({ pluginId, status: "ready" })]);
      expect(boot.tools.map((tool) => tool.name).sort()).toEqual([
        "data_map_search_objects",
        "data_quality_get_trend",
      ]);
      expect(boot.registry.list().map((binding) => binding.pluginId)).toEqual([pluginId, pluginId]);

      const result = await boot.agent.invoke(
        { messages: [new HumanMessage("Get the orders quality score.")] },
        {
          context: {
            executionContextId: `execution-${pluginId}`,
            contextSnapshotId: `snapshot-${pluginId}`,
            traceId: `trace-${pluginId}`,
            principalId: "user-1",
            tenantId: "tenant-1",
            authorizationRef: "mock-auth:user-1",
            contextObjectId: "orders",
            authorizedObjectIds: ["orders"],
            permissionScopes: ["data_quality:read"],
          },
          configurable: { thread_id: `thread-${pluginId}` },
        },
      );
      const toolMessage = result.messages.find(
        (message) => ToolMessage.isInstance(message) && message.name === "data_quality_get_trend",
      );

      const toolContent = toolMessage?.content;
      expect(typeof toolContent === "string" ? toolContent : JSON.stringify(toolContent)).toContain(
        '"value":96',
      );
      expect(result.messages.at(-1)?.content).toContain("96 percent");
    });
  }
});
