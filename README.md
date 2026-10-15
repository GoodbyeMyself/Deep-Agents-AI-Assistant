# Deep Agents AI Assistant

面向企业业务系统的通用 AI 智能助手集成框架。项目直接使用官方 Deep Agents TypeScript SDK 作为 Agent Harness，通过标准 Capability Contract、可信业务 Adapter、服务端权限继承、页面 ContextSnapshot 和 Evidence 追溯，把同一套助手能力安全地接入不同企业产品。

项目不是 OpenClaw 的重新实现，也不自研 Agent Loop、任务规划器或 LangGraph Checkpointer。不同产品使用同一份代码独立部署，Agent 只感知标准业务能力，不感知 Product A、B、C 的具体接口。

## 当前进度

V2.0 的 M0～M5 已完成本地工程与离线系统验收：

- M0：pnpm Monorepo、TypeScript、质量工具以及 Deep Agents Tool、Skills、Subagents、Backend、Checkpointer、Runtime Context 和 Streaming 验证。
- M1：Plugin SDK、可信 Plugin Loader、Capability Registry/Executor，以及 Product A/B 双 Adapter 自动挂载。
- M2：身份、ContextSnapshot、Session、Run、REST/SSE、Evidence 解引用、审计和取消闭环。
- M3：React 独立 Web、共享 Chat Core、受控 View Renderer、证据面板和管理状态查询。
- M4：React SDK、JavaScript SDK、跨 Origin iframe，以及一次性票据换取短期凭证。
- M5：A/B 独立部署配置、双实例 TCP 验收、标准契约一致性、安全/E2E、升级回滚和可观测性说明。

当前业务 API、Identity Provider 和持久化存储仍是 Mock/内存实现。工程验收通过不等同于生产上线；详细边界见 [M5 验收报告](docs/m5-acceptance-report.md)和 [实施状态](docs/implementation-status.md)。

## 核心原则

- 标准契约：Agent 只调用平台维护的 Capability，不直接依赖产品私有 API。
- 权限继承：身份、功能权限、对象/行列权限和脱敏由服务端及原业务系统强制执行。
- 页面感知：宿主页面 Context 先经服务端归一化，每个 Run 固定一个 Snapshot。
- 插件扩展：可信 Adapter 在启动时发现、校验、注册并转换为 Deep Agents Tools。
- 可信结果：业务结果携带来源、范围、时间、统计口径和 Evidence 引用；数据不足明确返回 `partial` 或标准错误。
- 独立部署：A/B/C 不共享会话、模型配置、凭证、存储或 Checkpointer，不建设集中式动态产品路由。

## 目录结构

```text
Deep-Agents-AI-Assistant/
├─ adapters/                         # 具体产品的业务 API → 标准 Capability 映射
│  ├─ demo-product-a/                # Product A 示例插件及契约测试
│  └─ demo-product-b/                # Product B 示例插件及契约测试
├─ apps/
│  ├─ agent-server/                  # Agent Server、REST/SSE、会话、Context、Evidence
│  │  ├─ migrations/                 # 持久化模型参考迁移
│  │  └─ src/m2/                     # 企业可信执行闭环
│  ├─ assistant-web/                 # 独立 React Web
│  └─ assistant-embed/               # iframe 内运行的助手页面
├─ core/
│  ├─ capability/                    # 标准契约、Catalog、Registry、Executor
│  ├─ context/                       # Host Context、Normalized Context、Snapshot 契约
│  ├─ evidence/                      # Evidence 安全解析与返回模型
│  └─ policy/                        # 服务端 Capability 授权策略
├─ packages/
│  ├─ agent-runtime/                 # Deep Agents 薄封装与动态 Tool Factory
│  ├─ assistant-sdk/                 # React Hook/组件和原生 JavaScript SDK
│  ├─ assistant-transport/           # 版本化 REST/SSE 客户端与断流续传
│  ├─ assistant-ui/                  # 独立 Web 与嵌入 Shell 共用的 Chat Core
│  ├─ contracts/                     # Assistant API、事件和 View 公共契约
│  ├─ iframe-bridge/                 # 跨 Origin 消息协议与校验
│  ├─ plugin-runtime/                # 插件发现、校验、加载、生命周期和 Driver
│  └─ plugin-sdk/                    # definePlugin/implementCapability 开发 API
├─ demo/                             # 所有可执行演示工程，和正式模块隔离
│  ├─ product-a/                     # Product A 数据治理接入演示
│  ├─ product-b/                     # Product B 数据资产接入演示
│  ├─ product-shell/                 # A/B 共用业务壳和助手接入层
│  ├─ sdk-host/                      # React/JS/iframe 三种接入方式演示宿主
│  ├─ server/                        # M3/M4/A/B 离线 Demo Server 入口
│  ├─ scripts/                       # 双产品一键启动与进程清理
│  └─ README.md                      # 演示目录边界和运行说明
├─ deployments/
│  ├─ product-a/.env.example         # A 实例独立部署样例
│  ├─ product-b/.env.example         # B 实例独立部署样例
│  └─ README.md                      # 部署、升级、回滚和可观测性说明
├─ docs/
│  ├─ architecture-v2.0/             # 唯一架构设计基线和 M0～M5 阶段规范
│  ├─ implementation-status.md       # 当前真实实施状态与生产边界
│  └─ m0-acceptance-report.md ...    # 各阶段真实验收记录
├─ skills/poc-data-quality/          # Deep Agents FilesystemBackend Skill 样例
├─ tests/capability-contract-testkit/ # Adapter 共享契约测试工具
├─ .env.example                      # 本地模型与 Agent Server 配置模板
├─ AGENTS.md                         # 仓库开发规则和架构约束
├─ pnpm-workspace.yaml               # pnpm Workspace 与依赖版本目录
└─ package.json                      # 根级开发、检查、测试和构建命令
```

`node_modules/`、构建产物、测试输出、本地 `.env` 和本地参考源码目录不属于正式工程结构，不应提交。

依赖方向遵循 `core → plugin-sdk/runtime → agent-runtime/server → UI/SDK`；Adapter 依赖标准契约和 Plugin SDK，Agent 核心不得依赖具体产品 Adapter。

## 环境要求与质量门禁

- Node.js 22+
- pnpm 10.32.1
- 可选：DeepSeek 或 OpenAI 兼容模型 API Key，仅真实模型烟测/服务需要

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

离线测试使用 LangChain 官方 Fake Model，但仍会真实运行 Agent 图、Tools、Plugin Loader、Subagent、MemorySaver 和 Streaming。当前全量门禁包含 75 个 Vitest 测试，另有 10 个 Chromium E2E 用例；数量以后续代码和验收报告为准。

## 查看页面效果

### 双产品业务接入演示（推荐）

一条命令同时启动 Product A、Product B 及其各自独立的 Agent Server：

```bash
pnpm demo
```

- Product A 数据质量运营台：`http://127.0.0.1:5411`
- Product B 数据资产驾驶舱：`http://127.0.0.1:5412`

两套页面复用同一个 Assistant SDK 和标准 Capability，但分别连接 `demo-product-a`、`demo-product-b` Adapter，端口、进程、会话与 Checkpointer 独立。完整讲解顺序和边界见 [双产品演示指南](docs/dual-product-demo-guide.md)。

![Product A 数据质量运营台](docs/demo-product-a.png)

![Product B 数据资产驾驶舱](docs/demo-product-b.png)

### 独立助手 Web

独立 Web 使用离线 Fake Model，不需要 API Key。分别打开两个终端：

```bash
pnpm --filter @assistant/demo-server serve:m3
```

```bash
pnpm dev:web
```

浏览器访问 `http://127.0.0.1:5173`，可以查看会话、流式回答、Tool 进度、质量趋势、Evidence 和实例管理状态。

嵌入式 React/JavaScript/iframe 效果及自动化运行方式见 [M4 验收报告](docs/m4-acceptance-report.md)。浏览器回归命令：

```bash
pnpm --filter @assistant/assistant-web e2e
pnpm --filter @assistant/demo-host e2e
```

## 使用真实模型

从根目录 `.env.example` 创建本地 `.env`，填写自己的配置，不要提交该文件：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-chat
```

执行真实 DeepSeek Tool Calling 烟测：

```bash
pnpm --filter @assistant/agent-server smoke:deepseek
```

启动真实模型 Agent Server：

```bash
pnpm dev:server
```

## 插件与独立部署

插件入口只允许从已批准的安装目录加载，并校验 Manifest、入口路径、协议版本、Capability 声明和构建产物哈希。开发样例位于 `adapters/demo-product-a` 与 `adapters/demo-product-b`。

A/B 独立部署样例、密钥边界、启动探针、升级和回滚步骤见 [deployments/README.md](deployments/README.md)。生产环境必须替换 Mock Identity、模拟业务 API、内存 Repository 和 `MemorySaver`，并配置独立密钥、持久化 Checkpointer、TLS、严格 CSP、Origin 白名单、指标告警与灾备恢复。

## 文档入口

- [架构文档索引](docs/architecture-v2.0/00-README.md)
- [架构基线与边界](docs/architecture-v2.0/01-架构基线与边界.md)
- [工程结构与依赖规则](docs/architecture-v2.0/03-工程结构与依赖规则.md)
- [安全、权限、证据与审计](docs/architecture-v2.0/08-安全权限证据与审计.md)
- [测试体系与质量门禁](docs/architecture-v2.0/16-测试体系与质量门禁.md)
- [架构决策记录](docs/architecture-v2.0/18-架构决策记录.md)
- [M5 验收报告](docs/m5-acceptance-report.md)
- [双产品演示指南](docs/dual-product-demo-guide.md)

## 安全提示

不要提交 `.env`、模型密钥、长期业务 Token、真实敏感数据或完整业务响应。Prompt、页面 Context 和前端 UI 都不是授权依据；最终权限与脱敏必须由服务端和原业务 API 执行。
