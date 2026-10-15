# M4 开发与验收报告

日期：2026-10-15

## 1. 阶段任务完成情况

| 任务                 | 状态 | 实际结果                                                                                |
| -------------------- | ---- | --------------------------------------------------------------------------------------- |
| M4-T01 SDK 公共 API  | 完成 | React 组件/Hook 与 JavaScript Instance；floating/drawer/inline；统一 Chat Core          |
| M4-T02 Host Context  | 完成 | `RawHostContext` 白名单、`getContext/updateContext`、提交时 Snapshot、X→Y 下一 Run 生效 |
| M4-T03 iframe Bridge | 完成 | 严格消息校验、sandbox、frame-ancestors、一次性票据换短期凭证                            |
| M4-T04 多宿主验证    | 完成 | React、JavaScript、跨域 iframe 在同一 Agent Server 上通过真实 Chromium 验证             |

## 2. 工程实现清单

- `packages/assistant-sdk`：公共控制器、React Provider/Surface/Hook、JavaScript
  `createAssistant` 实例和隔离的 SDK Shell 样式。
- `packages/iframe-bridge`：版本化消息协议、Host/Assistant Bridge、Origin/Source/Channel/
  Schema 校验。
- `apps/assistant-embed`：独立 iframe Shell，不从 URL 接收凭证。
- `demo/sdk-host`：React、原生 JavaScript、跨域 iframe 三种集成方式和页面上下文切换。
- `apps/agent-server/src/m2/embed-ticket.ts`：60 秒一次性票据和 5 分钟临时凭证交换。
- `packages/assistant-ui/src/ChatWorkspace.tsx`：支持由宿主提供 Context Provider，并在每次
  Run 创建前固定捕获上下文。
- `demo/sdk-host/tests`：真实浏览器集成与安全回归测试。

## 3. API 与安全验证结果

SDK 公共 API 为 `createAssistant(options)`、`mount/open/close/updateContext/getState/destroy`，
React API 为 `AssistantProvider`、`AssistantSurface`、`AssistantReact`、`useAssistant`。
SDK 只依赖 REST/SSE Transport，不向宿主暴露 Deep Agents 或 LangGraph 内部类型。

页面上下文只允许 page、object、business 和受限 metadata；未知字段会被 Zod strip。浏览器
不能提交可信 user/tenant/permission。Context X 的 Run 使用 X Snapshot；切到 Y 后，下一 Run
使用 Y Snapshot，已有 Run 不会被改写。

Bridge 消息固定 `protocol/version/channelId/requestId/type/payload`。接收端同时检查事件 Origin、
Window Source、Channel、版本和 Schema。宿主通过已认证 API 创建绑定 iframe Origin 的高熵票据；
票据 60 秒过期、无论成功或 Origin 不匹配均单次消费，iframe 交换后只取得 5 分钟临时凭证。
iframe URL 与 `postMessage` 不包含长期业务 Token。

样式层使用 `.assistant-sdk-root`、CSS 变量、`isolation` 与 Ant Design ConfigProvider 限定主题；
iframe 提供浏览器级硬隔离。直接 React/JavaScript 嵌入采用 scoped light DOM，并未引入 Shadow
DOM，以避免 Ant Design portal/style runtime 在 ShadowRoot 中产生不一致；这是有记录的实现选择。

## 4. 测试与构建记录

实际通过：

- `pnpm --filter @assistant/assistant-sdk test`：1 文件、2 测试通过。
- `pnpm --filter @assistant/iframe-bridge test`：1 文件、3 测试通过。
- `pnpm --filter @assistant/agent-server test`：3 文件、9 测试通过（含 M2/M1 既有测试）。
- `pnpm --filter @assistant/demo-host e2e`：3 个 Chromium 测试通过。
- `pnpm --filter @assistant/demo-host build`、`pnpm --filter @assistant/assistant-embed build`：通过，
  存在约 1.2 MB 的既有 Ant Design 单 chunk 警告。

全仓既有 `pnpm test` 加上最终安全回归共 25 个测试文件、70 个测试通过；`pnpm format:check`、`pnpm lint`、
`pnpm typecheck`、`pnpm build` 均通过。构建保留 Ant Design 单 chunk 大于 500 kB 的非阻断警告。

## 5. 架构一致性与偏差

- 遵守一个 Shared Chat Core、两个 Shell、同一 Agent Server、服务端权限与 Evidence 二次鉴权。
- 未实现插件市场、多渠道 Gateway、产品动态路由或新的 Agent Loop。
- 开发态 iframe Vite Server 为 React Refresh 临时允许 `script-src 'unsafe-inline'`；生产构建不应
  复用该 Header，必须使用 nonce/hash 且配置精确 `frame-ancestors`。
- React/JavaScript 直接嵌入使用 scoped light DOM；需要对完全不受控的宿主 CSS 做硬隔离时，
  应选择本阶段已验证的 iframe 模式。

## 6. 后续阶段准备情况

M4 已提供 M5 所需的 SDK API、安全 iframe 握手、跨宿主演示、真实浏览器回归入口和阶段文档。
生产 IdP、持久化 Store/Checkpointer、发布制品、生产 CSP 与部署观测仍是后续工作，不在 M4
完成范围内。当前无阻断 M4 退出的问题；不自动开始 M5。
