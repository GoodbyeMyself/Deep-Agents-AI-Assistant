# Assistant Transport

浏览器侧的版本化 Agent API 客户端，封装 Session、Message、Run、ContextSnapshot、Evidence、模型/插件状态和 iframe 票据请求。

## 流式能力

`AssistantApiTransport.watchRun` 保留私有 `AssistantEvent` 兼容路径；默认 Shared Chat Core 通过
`AgUiChatAgentPort.watchRun` 消费 `/runs/{id}/ag-ui/events`。两条路径读取同一持久 Run 日志，
维护各自游标和去重集合，并在网络中断后按配置重连。事件进入 UI 前会通过共享契约校验。

Run 创建、状态查询、显式取消、Session、ContextSnapshot 与 Evidence 仍使用受治理 REST；切换
AG-UI 事件格式不会建立第二个 Run，也不会把客户端 Context 或 Tool 当成授权依据。

Human-in-the-loop 暂停使用标准 AG-UI interrupt outcome。默认 Shared Chat Core 通过
`resumeRun` 调用受控 `/runs/{id}/resume`，标准 AG-UI 客户端则使用 `RunAgentInput.resume[]`；两条
入口复用同一个服务端待确认记录和续跑 Run，不允许普通新消息绕过审批。

## 安全边界

- 每个请求通过 `getAccessCredential` 获取当前短期凭证。
- 不持久化模型 API Key 或长期业务 Token。
- Evidence 解析由服务端再次授权。

## 验证

```bash
pnpm --filter @assistant/assistant-transport build
pnpm --filter @assistant/assistant-transport typecheck
pnpm --filter @assistant/assistant-transport test
```
