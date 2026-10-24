/**
 * MCP 协议与业务 Mock 的 in-memory 联调（不经 HTTP/stdio 子进程）。
 * 覆盖：Tool 清单与治理元数据、Schema 校验、授权、取消/超时。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import {
  PLATFORM_GOVERNANCE_META_KEY,
  PRODUCT_A_QUALITY_TREND_TOOL_NAME,
  PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
  PRODUCT_A_TABLE_METADATA_TOOL_NAME,
  PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
  createProductAMcpServer,
} from "../dist/index.js";

const ALL_PRODUCT_A_TOOL_NAMES = [
  PRODUCT_A_QUALITY_TREND_TOOL_NAME,
  PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
  PRODUCT_A_TABLE_METADATA_TOOL_NAME,
  PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
];

async function connect(options) {
  const server = createProductAMcpServer(options);
  const client = new Client({ name: "product-a-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

const validQualityInput = {
  tableId: "orders",
  startTime: "2026-10-07T00:00:00+08:00",
  endTime: "2026-10-14T00:00:00+08:00",
};

const validSampleRowsInput = {
  tableId: "orders",
  limit: 2,
};

function toolByName(tools, name) {
  const tool = tools.find((entry) => entry?.name === name);
  assert.ok(tool, `expected tool ${name}`);
  return tool;
}

test("Product A MCP advertises governed read-only Tools", async () => {
  const connection = await connect();
  try {
    const { tools } = await connection.client.listTools();
    assert.equal(tools.length, ALL_PRODUCT_A_TOOL_NAMES.length);
    for (const toolName of ALL_PRODUCT_A_TOOL_NAMES) {
      const tool = toolByName(tools, toolName);
      assert.equal(tool.annotations?.readOnlyHint, true);
      assert.equal(tool.inputSchema.type, "object");
      assert.equal(tool.outputSchema?.type, "object");
      assert.deepEqual(tool._meta?.[PLATFORM_GOVERNANCE_META_KEY], {
        protocolVersion: "1",
        riskLevel: "read",
      });
      assert.equal(tool._meta?.["com.deep-agents.business/tool"], undefined);
    }
  } finally {
    await connection.close();
  }
});

test("valid calls return Product A schema-validated structured results", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    const result = await connection.client.callTool({
      name: PRODUCT_A_QUALITY_TREND_TOOL_NAME,
      arguments: validQualityInput,
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "partial");
    assert.equal(result.structuredContent?.data?.unit, "percent");
    assert.equal(result.structuredContent?.data?.points?.[0]?.value, 96);
    assert.equal(
      result.structuredContent?.evidence?.[0]?.referenceId,
      "product-a:mcp:quality:orders",
    );
  } finally {
    await connection.close();
  }
});

test("identity injection and invalid ranges fail before the Product A handler", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    for (const argumentsValue of [
      { ...validQualityInput, userId: "admin" },
      {
        tableId: "orders",
        startTime: "2026-10-14T00:00:00+08:00",
        endTime: "2026-10-07T00:00:00+08:00",
      },
    ]) {
      const result = await connection.client.callTool({
        name: PRODUCT_A_QUALITY_TREND_TOOL_NAME,
        arguments: argumentsValue,
      });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
    }
  } finally {
    await connection.close();
  }
});

test("Product A object authorization errors stay structured", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    const result = await connection.client.callTool({
      name: PRODUCT_A_QUALITY_TREND_TOOL_NAME,
      arguments: { ...validQualityInput, tableId: "not-authorized" },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "error");
    assert.equal(result.structuredContent?.error?.code, "FORBIDDEN");
  } finally {
    await connection.close();
  }
});

test("valid sample-row calls return Product A schema-validated structured results", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    const result = await connection.client.callTool({
      name: PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
      arguments: validSampleRowsInput,
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "success");
    assert.equal(result.structuredContent?.data?.rows?.length, 2);
    assert.equal(result.structuredContent?.data?.truncated, true);
    assert.equal(
      result.structuredContent?.evidence?.[0]?.referenceId,
      "product-a:mcp:sample-rows:orders",
    );
  } finally {
    await connection.close();
  }
});

test("identity injection and invalid sample-row limits fail before the Product A handler", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    for (const argumentsValue of [
      { ...validSampleRowsInput, userId: "admin" },
      { tableId: "orders", limit: 21 },
    ]) {
      const result = await connection.client.callTool({
        name: PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
        arguments: argumentsValue,
      });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
    }
  } finally {
    await connection.close();
  }
});

test("Product A sample-row authorization errors stay structured", async () => {
  const connection = await connect();
  try {
    await connection.client.listTools();
    const result = await connection.client.callTool({
      name: PRODUCT_A_TABLE_SAMPLE_ROWS_TOOL_NAME,
      arguments: { tableId: "not-authorized", limit: 5 },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "error");
    assert.equal(result.structuredContent?.error?.code, "FORBIDDEN");
  } finally {
    await connection.close();
  }
});

test("table metadata calls return lineage from the metadata service mock", async () => {
  const connection = await connect();
  try {
    const result = await connection.client.callTool({
      name: PRODUCT_A_TABLE_METADATA_TOOL_NAME,
      arguments: { tableId: "orders" },
    });
    assert.equal(result.structuredContent?.status, "success");
    assert.equal(result.structuredContent?.data?.displayName, "订单事实表");
    assert.ok(result.structuredContent?.data?.lineage?.length >= 2);
  } finally {
    await connection.close();
  }
});

test("data asset search returns catalog hits", async () => {
  const connection = await connect();
  try {
    const result = await connection.client.callTool({
      name: PRODUCT_A_SEARCH_DATA_ASSETS_TOOL_NAME,
      arguments: { keyword: "order", limit: 5 },
    });
    assert.equal(result.structuredContent?.status, "success");
    assert.ok(result.structuredContent?.data?.total >= 1);
  } finally {
    await connection.close();
  }
});

test("client cancellation reaches the Product A Tool handler", async () => {
  let handlerSignal;
  let markEntered;
  const entered = new Promise((resolve) => {
    markEntered = resolve;
  });
  const connection = await connect({
    beforeQuery: async (_input, signal) => {
      handlerSignal = signal;
      markEntered();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5_000);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    },
  });
  try {
    const controller = new AbortController();
    const call = connection.client.callTool(
      { name: PRODUCT_A_QUALITY_TREND_TOOL_NAME, arguments: validQualityInput },
      { signal: controller.signal, timeout: 5_000 },
    );
    await entered;
    const rejection = assert.rejects(call);
    controller.abort(new Error("test cancellation"));
    await rejection;
    assert.equal(handlerSignal?.aborted, true);
  } finally {
    await connection.close();
  }
});

test("MCP request timeout cancels the Product A Tool handler", async () => {
  let handlerSignal;
  let markEntered;
  const entered = new Promise((resolve) => {
    markEntered = resolve;
  });
  const connection = await connect({
    beforeQuery: async (_input, signal) => {
      handlerSignal = signal;
      markEntered();
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  try {
    const call = connection.client.callTool(
      { name: PRODUCT_A_QUALITY_TREND_TOOL_NAME, arguments: validQualityInput },
      { timeout: 100 },
    );
    await entered;
    await assert.rejects(call);
    assert.equal(handlerSignal?.aborted, true);
  } finally {
    await connection.close();
  }
});
