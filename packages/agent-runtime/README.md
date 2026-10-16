# Agent Runtime

对官方 Deep Agents TypeScript SDK 的薄封装，负责标准 Capability Tool 装配、Runtime Context、Backend、Skills、Subagents、Checkpointer 和流式诊断适配。

## 主要导出

- `createAgentRuntime`：创建官方 Deep Agent。
- `createCapabilityTools`：把已注册 Capability 转换为 LangChain Tools。
- `runContextSchema`：运行时可信上下文 Schema。
- `sanitizeDiagnostic`：过滤可对外记录的诊断信息。

## 边界

本包不实现或 Fork Agent Loop、任务规划器、LangGraph 状态机或 Checkpointer。业务授权和结果校验仍由 Capability Executor 强制执行。

## 验证

```bash
pnpm --filter @assistant/agent-runtime build
pnpm --filter @assistant/agent-runtime typecheck
pnpm --filter @assistant/agent-runtime test
```
