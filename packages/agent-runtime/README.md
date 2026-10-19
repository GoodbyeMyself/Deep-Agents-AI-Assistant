# Agent Runtime

对官方 [Deep Agents](https://github.com/langchain-ai/deepagents) TypeScript SDK 的薄封装：在**不 Fork、不重写** Agent Loop / LangGraph 的前提下，完成标准 Capability Tool 装配、可信 Run Context、可选 Backend / Skills / Subagents / Checkpointer，以及对外诊断去敏。

包名：`@assistant/agent-runtime`。

## 在架构中的位置

```text
@assistant/capability-contracts  →  Catalog / Registry / Executor（业务执行与鉴权）
@assistant/plugin-runtime       →  启动时发现插件并注册 Capability
@assistant/agent-runtime        →  createDeepAgent + Tool 工厂（本包）
apps/agent-server               →  Composition Root，装配模型、插件与 Agent
```

依赖约束见 `docs/architecture-v2.0/03-工程结构与依赖规则.md`：本包可依赖 `deepagents`、`@assistant/capability-contracts` 与 LangChain 栈，**不得**导入具体产品 Adapter 或 A/B/C 分流逻辑。

## 目录结构（`src/`）

```text
src/
├── index.ts                          # 包公共导出
├── context/
│   └── run-context.ts                # runContextSchema / RunContext
├── diagnostics/
│   └── sanitize-diagnostic.ts        # 流式/日志诊断去敏
├── runtime/
│   └── agent-runtime.ts              # createAgentRuntime → createDeepAgent
└── tools/
    ├── capability-tool-factory.ts    # Registry → LangChain Tools（M1+）
    └── quality-trend-tool.ts         # M0 单能力烟测 Tool（可选）
```

## 主要导出

| 导出 | 说明 |
| --- | --- |
| `createAgentRuntime` | 调用官方 `createDeepAgent`，注入默认 system prompt、`contextSchema`、合并 Tools，并按需挂载 `FilesystemBackend`、`skills`、`subagents`、`checkpointer`。 |
| `AgentRuntimeOptions` | `model`（必填）、`tools`、`checkpointer`、`workspaceRoot`、`skills`、`subagents`；`executor` 仅在 M0 烟测路径注入内置 `data_quality_get_trend`。 |
| `createCapabilityTools` | 根据 `CapabilityRegistry` + `CapabilityCatalog` 为每个绑定生成 LangChain `tool()`；执行时把 `ToolRuntime.context` 映射为 `CapabilityExecutionContext` 并交给 `CapabilityExecutor.execute`。 |
| `createQualityTrendTool` / `QualityTrendExecutor` | 直接暴露 `data_quality.get_trend` 契约的单一 Tool；供 M0 真实模型烟测，M1 起通常由插件 + `createCapabilityTools` 替代。 |
| `runContextSchema` / `RunContext` | 服务端可信上下文 Zod Schema；通过 `invoke` / `stream` 的 `context` 传入，**不**进入模型可见的 Tool 参数 Schema。 |
| `sanitizeDiagnostic` | 递归剔除键名匹配敏感模式的字段，用于 SSE / 日志对外输出。 |

Tool 名称由 Capability ID 规范化（非字母数字替换为 `_`），冲突时工厂会抛错。

## 典型装配方式

**M0 烟测（单 Tool + Skills）** — 见 `apps/agent-server/src/main.ts`：

```ts
const agent = createAgentRuntime({
  model,
  executor: qualityTrendExecutor,
  workspaceRoot: repoRoot,
  skills: ["/skills/"],
});
await agent.invoke(
  { messages: [...] },
  {
    context: { executionContextId, contextSnapshotId },
    configurable: { thread_id },
  },
);
```

**M1+ 插件能力（推荐）** — 见 `apps/agent-server/src/composition/plugin-bootstrap.ts`：

```ts
const tools = createCapabilityTools({ catalog, registry, executor });
const agent = createAgentRuntime({ model, tools, checkpointer });
```

业务授权、Policy、审计与结果校验均在 `CapabilityExecutor` 与业务 API 侧强制执行；本包只负责把已注册能力挂到 Agent 上。

## 边界（本包不做的事）

- 不实现或修改官方 Agent Loop、规划器、LangGraph 图定义与 Checkpointer 实现。
- 不加载插件、不解析 Manifest（由 `plugin-runtime` / `agent-server` 负责）。
- 不把 UI Context 或 Prompt 当作授权依据；`RunContext` 由服务端在每次 Run 注入。

Deep Agents 版本与已验证 API 见 `docs/deepagents-compatibility.md`。

## 验证

```bash
pnpm --filter @assistant/agent-runtime build
pnpm --filter @assistant/agent-runtime typecheck
```

集成与流式行为由仓库级测试与 `agent-server` 烟测覆盖；本包当前未单独配置 `test` script。
