# Agent Runtime

`@assistant/agent-runtime` 是官方 Deep Agents TypeScript SDK 的平台薄封装，不 Fork 或重写 Agent Loop。

它只负责：

- 建立可信 `RunContext`；
- 挂载组合根传入的 LangChain Tools；
- 配置 Checkpointer、可选 Backend/Subagents 和运行策略；
- 对诊断信息去敏；
- 设置 Tool/Model 调用预算、超时、上下文压缩与回答发布策略。

业务 Tools 必须先由 `@assistant/mcp-client-runtime` 完成 MCP 发现、Schema 摘要校验和部署批准，再由
`apps/agent-server` 组合根传入。本包不包含 Capability Catalog、业务 Tool Factory、产品 Adapter、
Plugin Loader 或业务 Skill Snapshot。

```ts
const agent = createAgentRuntime({
  model,
  tools: approvedMcpTools,
  checkpointer,
  runtimePolicy,
});
```

主要导出为 `createAgentRuntime`、`AgentRuntimeOptions`、`runContextSchema`、运行策略 API 和
`sanitizeDiagnostic`。Deep Agents 版本与已验证 API 见
[`docs/deepagents-compatibility.md`](../../docs/deepagents-compatibility.md)。

验证命令须由用户执行：

```bash
pnpm --filter @assistant/agent-runtime build
pnpm --filter @assistant/agent-runtime typecheck
```
