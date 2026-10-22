# CopilotKit Shell Spike

隔离的 **AG-UI / CopilotKit 兼容性实验应用**，用 CopilotKit v2 `CopilotChat` 作为可选对话 Shell，验证「Shell 可替换、服务端契约不变」：仍经企业 REST 创建 Session 与 ContextSnapshot，再由 `HttpAgent` 调用同一 `POST /api/v1/ag-ui`。

**不是**默认生产 Shell，**不**进入 `assistant-ui` 依赖，**不**替换 Ant Design X 主 Shell。结论与验收见 [CopilotKit 可选 Shell Spike 验收报告](../../docs/acceptance/evolution/copilotkit-shell-spike-acceptance-report.md)。

## 协议链路

```text
CopilotChat → HttpAgent（AG-UI 客户端）→ POST /api/v1/ag-ui → agent-runtime
```

页面侧会先并行调用：

1. `AssistantApiTransport.createSession`（`standalone` 模式）
2. `AssistantApiTransport.createContextSnapshot`（含 `copilotkit-shell-spike` 页面类型与 Mock 业务对象）

再将 `contextSnapshotId` 放入 `CopilotKit` 的 `properties`，`threadId` 与 Session 对齐。

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/App.tsx` | Mock 身份切换、Session/Snapshot 初始化、`CopilotKit` + `CopilotChat` |
| `src/main.tsx` | Vite 入口 |
| `vite.config.ts` | 开发端口 `5176`，`/api` 代理到 `127.0.0.1:3000` |
| `tests/http-agent.test.mjs` | Node 专项：直接 `@ag-ui/client` `HttpAgent` 与受治理端点、Session/Snapshot 绑定 |
| `tests/browser-fixture-server.mjs` | 浏览器验收用 Fixture（见 [浏览器验收报告](../../docs/acceptance/evolution/copilotkit-shell-browser-acceptance-report.md)） |

## 刻意不包含（Spike 边界）

- Copilot Cloud / Copilot Runtime、license key
- 前端 Tool 注册、interrupt resume、多模态输入
- 生产授权与默认 Shell 切换
- Mock Bearer Token 持久化（仅内存与源码演示映射，不进 URL / storage / AG-UI state）

开发期使用 `agents__unsafe_dev_only` 注册本地 `HttpAgent`；**禁止**照抄到生产。

## 运行与验证

前置：本机已启动 **agent-server**（默认 `http://127.0.0.1:3000`），并配置可用的模型环境（与主仓库演示方式一致，例如根目录 `pnpm demo` 或 `pnpm dev:server`）。

```bash
# 仓库根目录
pnpm dev:copilotkit-spike

# 或等价
pnpm --filter @assistant/copilotkit-shell-spike dev
```

浏览器打开 Vite 提示的地址（默认 `http://127.0.0.1:5176`）。切换 **MOCK IDENTITY**（`mock-token-user-a` / `user-b` / `admin`）可验证不同用户下的会话与对象上下文。

```bash
pnpm --filter @assistant/copilotkit-shell-spike build
pnpm --filter @assistant/copilotkit-shell-spike typecheck
pnpm test:copilotkit-spike
```

### 兼容性说明

- 本仓库服务端与直接依赖锁定 `@ag-ui/client@1.0.3`；`@copilotkit/react-core@1.79.1` 内置 AG-UI 客户端为 1.0.2，二者均声明协议 **AG-UI 1.0**。
- 当前结论为 **1.0 线级兼容**；升级 CopilotKit 或 AG-UI 后须重跑 `pnpm test:copilotkit-spike`。
- 生产构建体积较大（含 Markdown/高亮等动态资源），在性能预算未达标前不作为默认 Shell 依据。

### 停止（Stop）行为

UI 上的停止会调用 `HttpAgent.abortRun()`，主要中止浏览器侧请求；**不能**单独证明服务端 durable run 已取消。生产接入前需受鉴权的 `cancelRun` 桥接，或在 UI 上禁用/重命名停止。

## 相关文档

- ADR 与实施记录：`docs/architecture-v2.0/18-架构决策记录.md`（CopilotKit 可选 Shell Spike）
- 实现状态摘要：`docs/implementation-status.md`
