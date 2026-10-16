# Assistant Web

企业助手的独立 Web Shell，面向不依附具体业务页面的对话、会话管理和当前部署状态查看。界面参考 **Codex 桌面端** 三栏布局（窄图标栏 + 列表区 + 主对话区），使用 React、Ant Design、Ant Design X，并复用 Shared Chat Core。

## 主要内容

- `src/App.tsx`：独立 Web 的页面路由和管理视图。
- `src/app.css`：Codex 风格 Shell 与浮动输入框样式。
- `tests/`：会话、流式回答、Evidence 和管理视图的浏览器回归。

## 边界

浏览器只消费版本化 REST/SSE 与受控 ViewModel，不直接处理 LangGraph 原始事件，也不执行插件返回的 HTML 或 JavaScript。所有管理接口仍需服务端鉴权。

## 运行与验证

```bash
pnpm --filter @assistant/assistant-web dev
pnpm --filter @assistant/assistant-web build
pnpm --filter @assistant/assistant-web typecheck
pnpm --filter @assistant/assistant-web e2e
```
