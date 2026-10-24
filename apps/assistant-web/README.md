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

独立 Web 只通过 Vite 把 `/api` 代理到 `ASSISTANT_API_TARGET`。配置从**仓库根目录** `.env` 读取（见 `apps/assistant-web/.env.example`）。

| 启动方式 | 典型 API 地址 | 身份 |
| --- | --- | --- |
| `deploy/local-compose.ps1 start -Group agents` + `pnpm dev:web` | 默认 `http://127.0.0.1:3411` | 对接 Docker 时自动 `VITE_IDENTITY_MODE=external`；须先在 Govern `http://127.0.0.1:19001` 登录 |
| `pnpm dev:server` + `dev:web` | `ASSISTANT_API_TARGET=http://127.0.0.1:3000` | 页面 Mock 身份 `mock-token-*` |
| 根目录历史 `pnpm demo` | `3410` 等（由启动器注入） | 见 demo 文档 |

Docker 平台 API 在 **3411**，容器内 Web 在 **8080**；本地 Vite 默认 **5173**。`deploy/identity-http.local.json` 的 `browserOrigins` 须包含你的 Vite 源（已含 `5173`）；改过后需重启 `agent-server` 容器。

在 **运行状态** 页查看模型：`deepseek` / `deepseek-chat` 表示真实演示；`offline` / `fake-model` 表示离线 Mock。

单独调试前端并对接 Docker 平台：

```powershell
# 可选：把 apps/assistant-web/.env.example 中的项写入仓库根 .env
pnpm dev:web
# 启动日志应显示：/api 代理 → http://127.0.0.1:3411
```

本机 `pnpm dev:server`（3000）时：

```powershell
$env:ASSISTANT_API_TARGET="http://127.0.0.1:3000"
$env:VITE_IDENTITY_MODE=""
pnpm dev:web
```
