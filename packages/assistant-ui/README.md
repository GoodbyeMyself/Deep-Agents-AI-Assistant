# Assistant UI

独立 Web、React SDK、JavaScript SDK 和 iframe 共用的聊天核心与安全视图组件，基于 React、Ant Design 和 Ant Design X。

## 主要组件

- `ChatWorkspace`：会话、消息、Run 和上下文的主工作区。
- `MessageList`、`ChatComposer`：流式消息与输入。
- `ExecutionTimeline`：Tool/Subagent 执行状态。
- `EvidencePanel`：授权后的证据解析。
- `AssistantViewRenderer`：受控 ViewModel 渲染。
- `SafeContent`：安全文本展示。

## 安全边界

本包只渲染白名单 View 类型，不执行后端或插件提供的 HTML/JavaScript。UI 中的权限提示不替代服务端授权。

## 验证

```bash
pnpm --filter @assistant/assistant-ui build
pnpm --filter @assistant/assistant-ui typecheck
pnpm --filter @assistant/assistant-ui test
```
