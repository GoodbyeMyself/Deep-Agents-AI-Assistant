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

### 连哪个 Agent Server？

独立 Web 只通过 Vite 把 `/api` 代理到 `ASSISTANT_API_TARGET`（默认 `http://127.0.0.1:3000`）。页面上使用的 `mock-token-*` 是 **演示用身份 Mock**，不代表后端一定是假模型。

| 启动方式 | 典型 API 地址 | 模型 |
| --- | --- | --- |
| 根目录 `pnpm demo`（推荐） | `http://127.0.0.1:3410`（由启动器注入环境变量） | 真实 DeepSeek + Product A 插件 |
| 仅 `pnpm dev:web` | 默认 `3000` | 若未起服务会失败；若起了 `demo-server serve:web-offline` 则为 **假模型固定话术** |
| `pnpm dev:server` + `dev:web` | `3000` 上的 `agent-server` | 真实 DeepSeek（需根目录 `.env`） |

在 **运行状态** 页查看模型：`deepseek` / `deepseek-chat` 表示真实演示；`offline` / `fake-model` 表示离线 Mock。

单独调试前端时，请先 `pnpm demo` 或手动：

```bash
# PowerShell（需已有 3410 上的 Standalone Agent Server，例如完整 pnpm demo）
$env:ASSISTANT_API_TARGET="http://127.0.0.1:3410"
pnpm --filter @assistant/assistant-web dev
```
