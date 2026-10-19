# Agent Server

企业助手的 Node.js 服务端入口，负责身份认证、Session、Run、ContextSnapshot、SSE、Evidence 二次鉴权和 Deep Agents 执行编排。

## 目录结构（`src/`）

```text
src/
├── main.ts                      # M0 真实模型烟测入口
├── server-main.ts               # 可部署 HTTP 服务入口
├── index.ts                     # 对外导出（演示与集成测试可引用）
├── composition/                 # Composition Root：插件装配与应用 wiring
│   ├── plugin-bootstrap.ts      # 可信插件发现、Capability 注册与 Agent 创建
│   └── create-application.ts    # 组装 Store、Runner、HTTP Handler
├── http/                        # 传输层：Fetch API Handler 与 Node HTTP 适配
│   ├── api.ts
│   └── node-http.ts
├── modules/                     # 按领域划分的应用模块（未来可抽到 platform/*）
│   ├── session/                 # Session、Run、消息、事件、Evidence 与审计存储
│   ├── context/                 # 页面上下文规范化与快照
│   ├── identity/                # 主体认证（当前为 Mock IdP）
│   └── embed/                   # iframe 一次性票据与短期凭证
├── shared/                      # 模块内共享类型与错误
│   └── errors.ts
```

包根目录 `migrations/` 为持久化参考脚本。

与 `docs/architecture-v2.0/03-工程结构与依赖规则.md` 一致：`modules/*` 对应后续可抽离的 `platform/session-service` 等；`composition/` 保持唯一装配点，不写产品名分支。

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
