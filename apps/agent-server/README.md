# Agent Server

企业助手的 Node.js 服务端入口，负责身份认证、Session、Run、ContextSnapshot、SSE、Evidence 二次鉴权和 Deep Agents 执行编排。

## 主要内容

- `src/plugin-bootstrap.ts`：可信插件发现、注册与 Tool 装配入口。
- `src/application/`：API、服务、Runner、存储、身份、上下文和 iframe 票据实现。
- `src/server-main.ts`：可运行服务入口。
- `migrations/`：持久化模型的参考迁移脚本。

## 安全边界

- UI Context 和 Prompt 不构成授权依据。
- Session、Run、事件和 Evidence 均按当前主体隔离。
- iframe 使用绑定 Origin 的一次性票据换取短期凭证。
- 当前内存 Store、Mock Identity 和 `MemorySaver` 仅适合开发及演示。

## 运行与验证

```bash
pnpm --filter @assistant/agent-server serve
pnpm --filter @assistant/agent-server typecheck
pnpm --filter @assistant/agent-server test
pnpm --filter @assistant/agent-server build
```

真实模型配置读取仓库根目录 `.env`，不得提交密钥。
