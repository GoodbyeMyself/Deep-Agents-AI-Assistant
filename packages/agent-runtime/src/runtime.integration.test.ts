import { fileURLToPath } from "node:url";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "langchain";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAgentRuntime } from "./runtime.js";
import type { QualityTrendExecutor } from "./quality-trend-tool.js";

const runContext = {
  executionContextId: "execution-1",
  contextSnapshotId: "snapshot-1",
};

function createExecutor(): QualityTrendExecutor {
  return {
    execute: vi.fn<QualityTrendExecutor["execute"]>((input, context) =>
      Promise.resolve({
        status: "success" as const,
        data: {
          tableId: input.tableId,
          metric: "quality_score" as const,
          unit: "percent" as const,
          aggregation: "daily" as const,
          timezone: "Asia/Shanghai",
          points: [{ time: "2026-10-13", value: 96 }],
        },
        evidence: [
          {
            id: "evidence-1",
            source: { type: "table" as const, id: input.tableId },
            collectedAt: "2026-10-13T00:00:00+08:00",
            referenceId: `reference-${context.executionContextId}`,
          },
        ],
        warnings: [],
      }),
    ),
  };
}

function invocationConfig(threadId: string) {
  return {
    context: runContext,
    configurable: { thread_id: threadId },
    recursionLimit: 50,
  };
}

describe("Deep Agents runtime integration", () => {
  it("executes a LangChain tool with trusted runtime context and returns its result", async () => {
    const executor = createExecutor();
    const model = fakeModel()
      .respondWithTools([
        {
          name: "data_quality_get_trend",
          id: "quality-call-1",
          args: {
            tableId: "orders",
            startTime: "2026-10-07T00:00:00+08:00",
            endTime: "2026-10-13T23:59:59+08:00",
          },
        },
      ])
      .respond(new AIMessage("The observed score is 96; see reference-execution-1."));
    const agent = createAgentRuntime({ model, executor });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Analyze the orders quality trend")] },
      invocationConfig("tool-thread"),
    );

    expect(executor.execute).toHaveBeenCalledOnce();
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: "orders" }),
      runContext,
    );
    const toolResult = result.messages.find(
      (message) => ToolMessage.isInstance(message) && message.name === "data_quality_get_trend",
    );
    expect(toolResult).toBeDefined();
    expect(JSON.stringify(toolResult?.content)).toContain("reference-execution-1");
    expect(result.messages.at(-1)?.content).toContain("observed score is 96");
  });

  it("restores one thread while keeping a different thread isolated", async () => {
    const agent = createAgentRuntime({
      model: fakeModel()
        .respond(new AIMessage("first answer"))
        .respond(new AIMessage("second answer"))
        .respond(new AIMessage("other answer")),
      executor: createExecutor(),
      checkpointer: new MemorySaver(),
    });

    await agent.invoke(
      { messages: [new HumanMessage("first question")] },
      invocationConfig("thread-a"),
    );
    await agent.invoke(
      { messages: [new HumanMessage("second question")] },
      invocationConfig("thread-a"),
    );
    await agent.invoke(
      { messages: [new HumanMessage("other question")] },
      invocationConfig("thread-b"),
    );

    const stateA = (await Promise.resolve(
      agent.getState({ configurable: { thread_id: "thread-a" } }),
    )) as unknown as { values: unknown };
    const stateB = (await Promise.resolve(
      agent.getState({ configurable: { thread_id: "thread-b" } }),
    )) as unknown as { values: unknown };
    expect(JSON.stringify(stateA.values)).toContain("first question");
    expect(JSON.stringify(stateA.values)).toContain("second question");
    expect(JSON.stringify(stateA.values)).not.toContain("other question");
    expect(JSON.stringify(stateB.values)).toContain("other question");
    expect(JSON.stringify(stateB.values)).not.toContain("first question");
  });

  it("loads a reviewed SKILL.md through FilesystemBackend", async () => {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const agent = createAgentRuntime({
      model: fakeModel().respond(new AIMessage("skill loaded")),
      executor: createExecutor(),
      workspaceRoot: repositoryRoot,
      skills: ["/skills/"],
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Use the data-quality skill")] },
      invocationConfig("skills-thread"),
    );

    expect(result.skillsMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "poc-data-quality",
          path: "/skills/poc-data-quality/SKILL.md",
        }),
      ]),
    );
  });

  it("delegates to a subagent that only receives its explicit read-only tool", async () => {
    const executor = createExecutor();
    const readOnlyHandler = vi.fn(({ query }: { query: string }) =>
      Promise.resolve(`verified:${query}`),
    );
    const readOnlyProbe = tool(readOnlyHandler, {
      name: "read_only_probe",
      description: "Return a verified read-only value.",
      schema: z.object({ query: z.string() }),
    });
    const workerModel = fakeModel()
      .respondWithTools([{ name: "read_only_probe", id: "probe-1", args: { query: "quality" } }])
      .respond(new AIMessage("worker completed with verified data"));
    const rootModel = fakeModel()
      .respondWithTools([
        {
          name: "task",
          id: "task-1",
          args: { description: "Run the read-only probe", subagent_type: "quality-reader" },
        },
      ])
      .respond(new AIMessage("delegation completed"));
    const agent = createAgentRuntime({
      model: rootModel,
      executor,
      subagents: [
        {
          name: "quality-reader",
          description: "Runs only an explicitly approved read-only probe.",
          systemPrompt: "Use read_only_probe and report its result.",
          model: workerModel,
          tools: [readOnlyProbe],
        },
      ],
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Delegate this read-only check")] },
      invocationConfig("subagent-thread"),
    );

    expect(readOnlyHandler).toHaveBeenCalledOnce();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.messages.at(-1)?.content).toContain("delegation completed");
  });

  it("surfaces a tool execution exception as a failed run", async () => {
    const failingExecutor: QualityTrendExecutor = {
      execute: () => Promise.reject(new Error("upstream unavailable")),
    };
    const model = fakeModel()
      .respondWithTools([
        {
          name: "data_quality_get_trend",
          id: "quality-failure-1",
          args: {
            tableId: "orders",
            startTime: "2026-10-07T00:00:00+08:00",
            endTime: "2026-10-13T23:59:59+08:00",
          },
        },
      ])
      .respond(new AIMessage("The tool failed, so no business conclusion is available."));
    const agent = createAgentRuntime({ model, executor: failingExecutor });

    await expect(
      agent.invoke(
        { messages: [new HumanMessage("Get the trend")] },
        invocationConfig("error-thread"),
      ),
    ).rejects.toThrow("upstream unavailable");
  });
});
