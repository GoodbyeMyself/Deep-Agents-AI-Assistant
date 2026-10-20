# apps

`apps/` 存放可独立启动或发布的应用入口。这里负责组合 Core、领域契约和平台 Packages，不承载
可复用业务契约，也不实现产品专属 API 映射。

## 当前应用

| 目录 | 职责 |
| --- | --- |
| `agent-server/` | 唯一服务端 Composition Root；装配身份、Session、Run、ContextSnapshot、Plugin Runtime、Agent Runtime、REST/SSE 和 Evidence |
| `assistant-web/` | 独立 React 助手 Web，提供聊天、会话和少量管理页面 |
| `assistant-embed/` | iframe 内的 Assistant Shell，以及声明式 `assistant-loader.js` 发布入口 |

业务产品演示不放在这里，统一位于根目录 `demo/`。

## 依赖边界

- `agent-server` 可以在组合根依赖 `core/*`、`domains/*` 和 `packages/*`，但不得按 Product A/B/C
  编写运行时路由分支。
- `assistant-web` 和 `assistant-embed` 复用 `assistant-ui`、`assistant-sdk`、
  `assistant-transport` 与 `iframe-bridge`，不得直接访问业务数据库或产品 API。
- 跨应用可复用代码应下沉到 `packages/*`；通用安全与执行规则应进入 `core/*`。
- 产品 API 字段映射只能进入 `adapters/*`。

## 运行入口

常用根命令：

```bash
pnpm dev:server
pnpm dev:web
pnpm dev:embed
```

构建后的正式部署不直接运行源码目录，操作方式见 [deploy/README.md](../deploy/README.md)。身份、
业务数据和持久化目前仍有 Mock/内存边界，详见
[实施状态](../docs/implementation-status.md)。
