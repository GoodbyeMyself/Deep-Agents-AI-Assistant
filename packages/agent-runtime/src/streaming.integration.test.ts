import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "langchain";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createAgentRuntime } from "./runtime.js";
import type { QualityTrendExecutor } from "./quality-trend-tool.js";

const executor: QualityTrendExecutor = {
  execute: (input) =>
    Promise.resolve({
      status: "success",
      data: {
        tableId: input.tableId,
        metric: "quality_score",
        unit: "percent",
        aggregation: "daily",
        timezone: "Asia/Shanghai",
        points: [],
      },
      evidence: [],
      warnings: [],
    }),
};

const config = {
  context: { executionContextId: "stream", contextSnapshotId: "snapshot-stream" },
  configurable: { thread_id: "stream-thread" },
  recursionLimit: 50,
};

function createStreamingAgent() {
  const probe = tool(({ value }: { value: string }) => Promise.resolve(`verified:${value}`), {
    name: "read_only_probe",
    description: "Read a verified value.",
    schema: z.object({ value: z.string() }),
  });
  const workerModel = fakeModel()
    .respondWithTools([{ name: "read_only_probe", id: "probe-stream-1", args: { value: "ok" } }])
    .respond(new AIMessage("subagent stream complete"));
  const rootModel = fakeModel()
    .respondWithTools([
      {
        name: "task",
        id: "task-stream-1",
        args: { description: "Use the probe", subagent_type: "stream-worker" },
      },
    ])
    .respond(new AIMessage("root stream complete"));

  return createAgentRuntime({
    model: rootModel,
    executor,
    checkpointer: new MemorySaver(),
    subagents: [
      {
        name: "stream-worker",
        description: "A read-only streaming worker.",
        model: workerModel,
        tools: [probe],
      },
    ],
  });
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

describe("Deep Agents streaming", () => {
  it("emits raw update namespaces for the model, tools, and subagent", async () => {
    const agent = createStreamingAgent();
    const stream = await agent.stream(
      { messages: [new HumanMessage("Delegate a streaming task")] },
      { ...config, streamMode: "updates", subgraphs: true },
    );
    const eventShapes: Array<{ namespace: string[]; nodes: string[] }> = [];

    for await (const [namespace, chunk] of stream) {
      eventShapes.push({
        namespace,
        nodes: Object.keys(chunk).sort(),
      });
    }

    expect(
      eventShapes.some((event) => event.namespace.some((part) => part.startsWith("tools:"))),
    ).toBe(true);
    expect(eventShapes.some((event) => event.nodes.includes("model_request"))).toBe(true);
    expect(eventShapes.some((event) => event.nodes.includes("tools"))).toBe(true);
  });

  it("emits raw message chunks for text, tool calls, tool results, and subagents", async () => {
    const agent = createStreamingAgent();
    const stream = await agent.stream(
      { messages: [new HumanMessage("Delegate a streaming task")] },
      {
        ...config,
        configurable: { thread_id: "message-stream-thread" },
        streamMode: "messages",
        subgraphs: true,
      },
    );
    let sawText = false;
    let sawToolCall = false;
    let sawToolResult = false;
    let sawSubagent = false;

    for await (const [namespace, chunk] of stream) {
      const [message] = chunk;
      sawSubagent ||= namespace.some((part) => part.startsWith("tools:"));
      if (AIMessage.isInstance(message)) {
        sawText ||= message.text.length > 0;
        sawToolCall ||= (message.tool_calls?.length ?? 0) > 0;
      }
      sawToolResult ||= ToolMessage.isInstance(message);
    }

    expect({ sawText, sawToolCall, sawToolResult, sawSubagent }).toEqual({
      sawText: true,
      sawToolCall: true,
      sawToolResult: true,
      sawSubagent: true,
    });
  });

  it("exposes v3 message, tool-call, subagent, and completion streams", async () => {
    const agent = createStreamingAgent();
    const run = await agent.streamEvents(
      { messages: [new HumanMessage("Delegate a streaming task")] },
      {
        ...config,
        configurable: { thread_id: "v3-stream-thread" },
        version: "v3",
      },
    );

    const messagesPromise = collect(run.messages);
    const toolCallsPromise = collect(run.toolCalls);
    const subagentsPromise = collect(run.subagents);
    const [messages, toolCalls, subagents, output] = await Promise.all([
      messagesPromise,
      toolCallsPromise,
      subagentsPromise,
      run.output,
    ]);

    expect(messages.length).toBeGreaterThan(0);
    expect(toolCalls.some((call) => call.name === "task")).toBe(true);
    expect(subagents).toHaveLength(1);
    expect(output.messages.at(-1)?.content).toContain("root stream complete");
  });
});
