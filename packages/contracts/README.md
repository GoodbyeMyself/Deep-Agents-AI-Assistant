# Assistant API Contracts

前后端共享的 Assistant API、SSE 事件和受控 ViewModel 契约。

## 主要内容

- Session、Run 和 API Error 请求 Schema。
- 版本化 `AssistantEvent` 及事件类型。
- text、metric、table、line chart 和 references ViewModel。
- 当前 Agent API 的 OpenAPI 入口文档。

## 边界

此包描述传输层协议，不承载业务 Capability 语义；业务契约位于 `core/capability`。任何事件或 View 变更都应保持版本兼容并同步更新前后端测试。

## 验证

```bash
pnpm --filter @assistant/contracts build
pnpm --filter @assistant/contracts typecheck
pnpm --filter @assistant/contracts test
```
