# Assistant Transport

浏览器侧的版本化 Agent API 客户端，封装 Session、Message、Run、ContextSnapshot、Evidence、模型/插件状态和 iframe 票据请求。

## 流式能力

`watchRun` 消费 SSE 事件，维护事件游标和去重集合，并在网络中断后按配置重连。事件进入 UI 前会通过共享契约校验。

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
