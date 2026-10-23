# Deep Agents AI Assistant

企业业务智能体的**平台仓库**。主仓只负责身份、会话、上下文、模型与 Agent 运行、MCP 客户端治理、
平台扩展、Evidence、HTTP/SSE/AG-UI、Web/Embed Shell；**所有业务能力由各系统独立 MCP Server 提供**。

## 架构边界

```text
Product A ──> Product A MCP ──┐
                              ├──> MCP Client Runtime ──> Deep Agents ──> Platform API/UI
Product B ──> Product B MCP ──┘
         Platform Extensions（如宿主导航）──^
```

- **一系统一 MCP**：每个业务系统对应独立 MCP 项目与部署单元；MCP 拥有 Tool、Schema、业务 API 映射与权限校验。
- 主仓**不**提供共享业务 Domain、跨产品 Adapter、业务 Skill 或业务模板。
- Agent 只接收平台发现并批准的 **MCP Tools** 与经部署批准的 **Platform Extension Tools**。
- UI Context、Prompt 和 Tool 参数**不是**授权依据；MCP Server 与原业务 API 负责最终权限与脱敏。

目标架构与边界见 [`docs/architecture-v2.0/22-V2.2-一系统一MCP架构.md`](docs/architecture-v2.0/22-V2.2-一系统一MCP架构.md)。实施进度见 [`docs/implementation-status.md`](docs/implementation-status.md)。

## 仓库关系

| 路径 | 说明 |
| --- | --- |
| `E:\Deep-Agents-AI-Assistant` | 本仓库（平台） |
| `E:\Deep-Agents-AI-Assistant-MCP` | 业务 MCP（如 `product-a-mcp`、`product-b-mcp`） |
| `E:\Deep-Agents-AI-Assistant-Demo` | 产品宿主演示（React/Vue 页面 + iframe 接入） |

三个仓库**不**使用 workspace 或 `file:` 相互引用；演示与 MCP 需单独 `pnpm install` / `build`。

## 主仓结构

```text
apps/
  agent-server/              # Composition Root：REST/SSE/AG-UI、Session/Run、MCP 与 Extension 装配
  assistant-web/             # 独立 Web Shell（会话、聊天、运行状态）
  assistant-embed/           # iframe Shell + 声明式 assistant-loader.js
  copilotkit-shell-spike/    # AG-UI 实验 Shell（可选）
extensions/
  host-navigation/           # 声明式宿主导航按钮（opaque target，无 URL）
  platform-diagnostics/      # 平台诊断参考 Extension
packages/
  agent-runtime/             # 官方 Deep Agents 薄封装
  mcp-client-runtime/        # MCP Tool 治理、批准快照、LangChain Tool 转换
  platform-extension-runtime/# Platform Extension Manifest、Loader、Tool Factory
  contracts/                 # 跨端协议（含 AG-UI、View、Host Action）
  assistant-transport/       # 浏览器 API 客户端
  assistant-ui/              # Shared Chat Core
  assistant-sdk/             # 宿主 SDK（React）
  iframe-bridge/             # iframe 安全桥与 loader 宿主逻辑
core/
  context/                   # ContextSnapshot 与宿主 Context 契约
  evidence/                  # Evidence 元数据与解析
docs/                        # 架构、ADR、验收与实施状态
deploy/                      # 平台 Server/Web/Embed 打包
tests/                       # 平台与集成测试
start-local-development.ps1  # Windows 本地多进程启动（见下文）
```

已移除的旧机制：`adapters/`、`domains/`、业务 `plugin-runtime`、跨系统 Capability 层等（见 ADR-027 及架构文档）。

## 本地开发（Product A 默认链路）

### 一次性准备

1. 主仓根目录配置 `.env`（模型 Key 等，勿提交 Git）。
2. MCP 仓构建 stdio 入口，例如 `product-a-mcp/dist/stdio.js`。
3. 三个仓库分别 `pnpm install`；主仓建议 `pnpm build`。

### 一键启动（Windows）

```powershell
cd E:\Deep-Agents-AI-Assistant
.\start-local-development.ps1 -OpenBrowser
```

或双击 `start-local-development.cmd`。

**默认**启动（不含 Product B）：

| 组件 | 地址 | 说明 |
| --- | --- | --- |
| Product A Agent Server | `http://127.0.0.1:3411` | 含 stdio MCP、Product A 的 `host-navigation` Extension |
| Product A Embed | `http://127.0.0.1:5511` | iframe 助手；API 代理到 `3411` |
| Product A Demo（独立 Demo 仓） | `http://127.0.0.1:5411` | 宿主页面 |
| 独立 Web 助手 A | `http://127.0.0.1:5173` | API 代理到 `3411` |

脚本会先等待 `3411` OpenAPI 就绪，再拉起 Embed / Demo / 独立 Web，避免助手 API 502。

常用参数：

```powershell
.\start-local-development.ps1 -IncludeProductB -OpenBrowser   # 再启动 B 链路（3412/5512/5412/5174）
.\start-local-development.ps1 -SkipStandaloneWeb              # 不启动独立 Web
.\start-local-development.ps1 -IncludeSdkHost -OpenBrowser    # SDK Host + 3310
.\start-local-development.ps1 -DryRun                         # 只检查，不起进程
```

日志目录：`logs/local-development/<时间戳>/`。端口占用时需先关闭旧终端。

### 手工启动（分终端）

```powershell
# 终端 1 — Agent Server（示例 Product A）
$env:SERVER_PORT='3411'
$env:DEPLOYMENT_ID='local-product-a'
# 配置 MCP_SERVERS、PLATFORM_EXTENSIONS 等，见 start-local-development.ps1
pnpm dev:server

# 终端 2 — Embed（须对齐 API 与宿主 Origin）
$env:ASSISTANT_EMBED_PORT='5511'
$env:ASSISTANT_API_TARGET='http://127.0.0.1:3411'
$env:ASSISTANT_HOST_ORIGIN='http://127.0.0.1:5411'
pnpm dev:embed

# 终端 3 — Demo 仓
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:product-a
```

**Embed 鉴权**：iframe 使用短期 `embed_*` 凭证，非宿主 HTML 里的 `mock-token-*`。重启 Agent Server 后若出现 `401`，应刷新宿主页面或关闭再打开助手；运行时会通过桥接自动申请新 ticket。

### 根目录常用命令

```bash
pnpm dev:server    # Agent Server
pnpm dev:web       # 独立 Web（ASSISTANT_API_TARGET / ASSISTANT_WEB_PORT）
pnpm dev:embed     # Embed + loader
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

各 `apps/*` 说明见 [`apps/README.md`](apps/README.md)。平台扩展见 [`extensions/README.md`](extensions/README.md)。

## 文档与规范

- 架构入口：[`docs/architecture-v2.0/00-README.md`](docs/architecture-v2.0/00-README.md)
- Codex / Agent 实施纪律：[`AGENTS.md`](AGENTS.md)
- 平台扩展机制：[`docs/architecture-v2.0/23-平台扩展机制.md`](docs/architecture-v2.0/23-平台扩展机制.md)

## 当前能力摘要

- MCP Client Runtime：Tool 治理、Schema 摘要批准、超时与结果大小限制。
- Agent Server：stdio MCP 子进程、批准 Tool 注入 Deep Agents、AG-UI Run/SSE、会话与 Evidence。
- Platform Extensions：如 `host-navigation`（对话内导航按钮，target 由宿主白名单映射路由）。
- 前端：Shared Chat Core、独立 Web、iframe Embed + `assistant-loader.js`、iframe 桥接与 embed ticket。

生产级 MCP 传输（Streamable HTTP、TLS、健康检查与密钥引用）按 V2.2 路线图后续阶段实现。

## 安全提醒

不要提交模型 Key、长期业务 Token、真实敏感样本或完整原始业务响应。业务权限与脱敏必须在 MCP 与原业务 API 侧强制执行。
