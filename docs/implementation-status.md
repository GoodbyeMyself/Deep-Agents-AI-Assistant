# 实施状态

更新日期：2026-10-24

## 用户提供的助手 SVG（待用户构建验证）

- 根据用户指定的“智能助手.svg”，替换 Loader、Panel Header、独立 Web 与 favicon。保留原图蓝色/浅蓝色，圆形入口配浅蓝底、蓝色边框与阴影。
- 仅提取 8 个静态 path 与颜色，不复制 DOCTYPE、编辑器属性或外部引用；不加载远端 SVG 资源。名称配置与权限不变。
- pnpm、构建和 Docker 发布尚未执行；待用户重新打包验证。

## 助手品牌与名称配置（待用户构建验证）

- 圆形 Loader、Panel Header 和独立 Web 使用星芒与轨道标识，Web 同步提供 SVG favicon。
- 宿主 data-assistant-title / JS title 经 assistantTitle URL 参数传入 iframe 并应用到 SDK Header；纯展示参数，不参与授权。空名称回退默认值，限制 80 字符，标题省略并保留 title 提示。
- Web 的 VITE_ASSISTANT_APP_NAME 支持主仓 .env（对应模式文件）与构建进程环境变量，后者优先；用于品牌和页面标题。空值默认“企业智能助手”。
- 只修改品牌相关前端；pnpm、构建、Docker 发布与浏览器验收尚未执行。差异检查通过，待用户验证。

## 前端构建信息（待用户构建验证）

- Web、Embed 与宿主 Loader 分别在模块启动时 console.info 输出构建信息，前缀区分来源，避免 React StrictMode 重复输出。
- 两个 Vite 配置复用 deploy/build-info.mjs，仅注入构建时间（UTC ISO 8601）、主仓分支、完整 commit 与 dirty 标记；不读取 .env。Git 不可用时显示 unknown，detached HEAD 明确标识。
- Node 直接调用元数据采集已通过；pnpm 未执行，打包后浏览器输出与 Docker 更新待用户验证。

## 独立 Web 管理页面拆分（待用户构建验证）

- 用户确认拆分：模型配置 `/models`、MCP 管理 `/mcp`、平台扩展 `/platform-extensions`；旧 `/runtime` 使用 replace 重定向至 `/mcp`。
- MCP 页面上下展示接入状态与工具列表；状态仅表示部署接入元数据，不宣称持续探活。模型配置仅展示，修改仍走部署配置。
- 各区域独立请求、刷新、加载与错误提示；身份切换隐藏旧数据；管理员区域不向普通用户发送请求，后端鉴权保持不变。
- 三个页面沿用内容区内部滚动；不改聊天页面、数据库、模型运行时或 MCP 业务契约。
- 本次未执行 pnpm，未构建或更新 Docker；Lint、类型、构建及浏览器验证等待用户执行命令后继续。

## 助手入口与会话操作（已完成）

- 用户确认圆形 AI 入口、头部独立页按钮和会话重命名/二次确认软删除，并明确授权本任务由 Codex 执行 pnpm。
- 入口和宿主头部链接已实现，地址可配置，保持 iframe 隔离与凭证边界；本地打包注入独立 Web 地址。
- Shared Chat Core 通过现有 Transport 接口管理会话；名称校验、失败提示和执行中禁用保护已实现。
- ADR-032 记录前端端口扩展与交互边界；pnpm lint、typecheck、test、pack:local 实际通过。
- Web/Embed/Demo 镜像已更新；六服务运行，后端/MCP/PostgreSQL 健康。浏览器验证圆形入口、新标签页打开、重命名刷新保留、删除取消保留和确认后刷新移除。
- 验收仅操作新建空白测试会话；现有历史和 PostgreSQL 卷保留。修复固定 Loader 文件名缓存引用旧资源问题：Embed no-cache，Demo 更新入口版本。
- 会话操作在独立 Web 的 Shared Chat Core 完成真实 API 验收；嵌入页验证入口、头部链接和历史渲染，未另行重复模型调用。

## Docker / PostgreSQL 持久化（实施中）

**最终本地状态（2026-10-24）：六服务已启动，本地持久化与真实模型恢复验收通过。**
详见 [本地 Docker 验收报告](acceptance/evolution/local-docker-acceptance-report.md)。
Product A HTTP MCP、Agent Server、PostgreSQL 健康；三个前端首页和 API 返回 200。
PostgreSQL 与后端容器重建后，同 Session 历史、事件和真实模型 Checkpoint 记忆均恢复。
实际模型调用 HTTP MCP 并解析 Mock Evidence 成功，数据库备份成功。下面保留实施过程记录。

- 用户已安装 pg 8.23.1、@types/pg 8.23.1、官方 checkpoint-postgres 1.0.6。
- 新增异步 AgentStore、PostgreSQL Store/平台建表迁移、事务化 Run 幂等/终态/事件序号、平台审计和
  官方 PostgresSaver 装配；Service、Runner、HTTP 和 AG-UI 调用方已等待数据库提交。
- DATABASE_URL 显式启用数据库；未配置时保留现有内存测试路径。数据库故障不回退内存。
- 单实例数据库租约与启动恢复避免重复执行；遗留 Run 以 SERVER_RESTARTED 失败，不自动续跑。
- 新增真实数据库专项 tests/postgres/persistence.test.mjs 和用户命令 pnpm test:postgres。
- 本地 Docker PostgreSQL 已真实启动并健康：127.0.0.1:55432，assistant 应用库及 assistant_test 测试库，
  命名卷 assistant-local_postgres-data；密码随机生成到已忽略的 deploy/.env.local，未输出凭证。
- 本次 lint/typecheck/build、PostgreSQL 专项、现有全量回归及容器重建后实际对话均未执行，待用户验证。
- 用户随后提供 pnpm test 输出：Agent Server 与依赖构建通过，MCP 测试 11/11；平台扩展 8/10，
  后续测试因脚本串联未执行。两项失败已定位为中文诊断文案断言过时和迁移后 Skill LF 属性路径失效；
  已同步断言、修正 Git 属性并归一化当前文件换行，保留原摘要与漂移阻断规则，待用户重新运行验证。
- 用户已确认上述修复后的质量门禁与 PostgreSQL 专项全部通过；该结果适用于存储模块版本，不覆盖后续 HTTP MCP 新增代码。
- 后续新增 HTTP MCP Client、本地 HMAC 短期委托与 Product A 验签/Host/健康检查、三仓打包、六服务 Compose、
  启停和备份脚本。配置静态校验通过；本轮标准 pnpm 门禁、HTTP MCP 专项、镜像构建和整套应用部署待执行。
- 用户已在主仓 .env 配置 DeepSeek；部署加载主仓模型设置，不输出或写入镜像。只有 PostgreSQL 已启动，
  尚未宣称整套应用部署完成。
- 用户随后确认 typecheck/lint/test/pack:local 完成，五个应用镜像已构建。启动时发现 Windows pnpm
  绝对 junction 在 Linux 镜像失效；新增构建阶段链接转换后，又检测到包自身指向源码目录的链接。
  检查器按预期拒绝该未处理链接，未放宽逃逸校验。按用户循环保护停止后续自动修复，待确认定向处理
  与 package.json.name 一致的自引用链接；完整应用未启动，模型与重建恢复验收未执行。
- 设计依据 ADR-030；身份与业务 API 仍为 Mock，数据库持久化不代表生产集成完成。

> 当前架构以 V2.2“一系统一 MCP”为准。M0～E5 章节是已经退出运行路径的历史实施记录，不代表
> 当前目录仍存在。主仓的 Adapter、Domain、业务 Skill/Template、Plugin SDK/Runtime、Capability
> Catalog/Executor/Policy 及兼容层已经删除；当前状态见文末“V2.2”。

## M0：工程初始化与框架验证

状态：完成并通过退出门禁，质量门禁结果见 [M0 验收报告](acceptance/milestones/m0-acceptance-report.md)。

- 已建立 pnpm workspace、TypeScript strict、ESLint、Prettier、Vitest、CI 与环境变量样例。
- 当时建立了 `core/capability`、`packages/agent-runtime`、`apps/agent-server`；其中
  `core/capability` 已在 V2.2 清理，以下内容仅为历史验收记录。
- 已锁定并执行 `deepagents@1.14.2`，验证 Tool、Runtime Context、Skills、
  Subagent、FilesystemBackend、MemorySaver 和 Streaming。
- 已建立最小质量趋势标准契约示例，为 M1 Tool Factory 对接保留产品无关边界。
- 已使用 `deepseek-flash` 完成真实模型 Tool Calling 烟测：Agent 调用标准质量趋势 Tool、
  收到 ToolMessage，并基于合成 Evidence 生成最终回答；凭证未写入源码或日志。
- M0 未提前实现 Plugin SDK/Loader/Registry；这些能力已在后续 M1 完成。

当前仍未宣称 Agent Server HTTP API、真实业务权限、页面上下文、Evidence 解引用或前端
已经上线。这些属于后续明确阶段；插件自动挂载已在 M1 完成。

## M1：插件自动发现与双 Adapter POC

状态：完成并通过退出门禁，质量与安全证据见 [M1 验收报告](acceptance/milestones/m1-acceptance-report.md)。

- `data_map.search_objects@1.0.0` 与 `data_quality.get_trend@1.0.0` 已成为平台维护的
  Zod 契约，包含标准错误、Evidence、`partial` 与缺失日期语义。
- 已实现自研 Plugin SDK、Manifest V1、批准名单、真实路径/符号链接防逃逸、构建产物
  SHA-256、Local Loader、简单 HTTP Driver、Plugin Registry 和 Capability Registry。
- Capability Executor 按输入校验 → 权限策略 → Provider → 输出校验 → Audit 顺序执行；
  Tool 参数不包含用户、租户或凭证。
- A/B 两个 Adapter 使用不同原始字段，均通过共享契约测试，并在两个独立安装根启动后
  自动产生相同的 Deep Agents Tool 集合，无产品分支逻辑。
- 自动化覆盖未批准模块不执行、路径逃逸、未知协议/契约、完整性不匹配、声明实现不一致、
  重复插件/Provider、缺少权限和未安装能力不可见。

M1 仍使用模拟业务数据和进程内 Local Adapter；HTTP Driver 通过受控 Fetch 测试，未连接
真实企业服务。真实身份委派、页面 ContextSnapshot 服务、持久化 Audit/Evidence 解析、
Session/SSE 属于 M2，当前未宣称完成。

## M2：企业可信执行闭环

状态：完成 M2 阶段退出门禁，详细证据与 Mock 边界见 [M2 验收报告](acceptance/milestones/m2-acceptance-report.md)。

- 已实现 `/api/v1` Node HTTP API、Zod 请求/SSE/View 契约和 OpenAPI 3.1 描述，支持
  ContextSnapshot、Session、历史消息、归档/软删除、幂等 Run、取消、SSE 与 Evidence 解引用。
- Mock Identity Provider 仅从 Bearer Token 建立可信用户/租户/权限/对象范围；浏览器提交的
  `user`、`permissions` 不进入 Normalized Context。
- 每个 Run 固定 ContextSnapshot，并使用服务端生成的 Runtime Context 调用当前插件 Tool；
  Capability Policy 与模拟业务 Adapter 对对象访问分别拒绝，参数 Schema 使用严格白名单。
- Event Bridge 把官方 Deep Agents message stream 转为版本化事件日志，支持实时推送、
  `Last-Event-ID` 重放、序号去重、游标过期错误、取消和终态。
- Evidence 只向客户端返回安全引用元数据，并按当前用户、租户、对象范围再次鉴权；Capability
  Audit 记录主体、Run/Session、能力、结果和引用，不记录模型密钥或原始业务响应。
- Session 元数据与官方 LangGraph `MemorySaver` Checkpointer 分离；同一进程内同一 Thread
  连续对话已验证。已提供 PostgreSQL 参考迁移、索引、软删除和清理策略。

M2 的身份源、业务数据、业务 API 授权和存储驱动仍为 Mock/内存实现。生产接入必须替换为
企业 IdP、原产品 API 与持久化 Session/Event/Audit Repository，并使用官方持久化
Checkpointer；当前不宣称跨进程重启恢复或真实产品权限集成完成。

## M3：React 独立 Web 与共享聊天

状态：完成并通过退出门禁，详细工程证据见 [M3 验收报告](acceptance/milestones/m3-acceptance-report.md)。

- 已实现 `assistant-transport`：Bearer REST、Fetch SSE、事件 Schema 校验、断流续传、
  `Last-Event-ID`、事件去重与终态查询，不把网络断开伪装为完成。
- 已实现 React Shared Chat Core：会话切换、增量文本、取消、Evidence 二次解析，以及
  text/metric/table/chart.line/references 受控 View Renderer。公开 Tool/Subagent 进度使用
  Ant Design X ThoughtChain 归属到对应助手消息；执行中展开、完成后折叠，支持显式展开/收起；
  步骤同时展示业务名称、标准 Capability 标识和公开协作 namespace，但不展示模型私有推理。
- 消息列表使用 Ant Design X `Bubble.List`，模型正文使用 `@ant-design/x-markdown@2.9.0`
  解析 CommonMark/GFM；流式状态传递给渲染器，原始 HTML 转义为文本并保留 XSS 净化边界。
  助手回复气泡下方使用 `Actions`（复制、反馈）作为 `footer` 操作区。
- 独立 Web 已提供业务对象选择语义、用户会话管理、模型/能力状态和管理员插件状态；
  普通用户与管理员页面按服务端权限分离。
- 使用 React 19、Ant Design 6.6.6、Ant Design X 2.9.0 与 Vite 8.3.4；未直接消费
  LangGraph raw chunk，未进入 M4 React/JS/iframe SDK。
- 独立 Web Shell（`assistant-web`）已对齐 Ant Design Pro：`ProLayout` 导航、
  `PageContainer`/`ProCard` 管理页，与 `demo/product-a` 宿主壳一致；聊天区仍复用
  Shared Chat Core。
- Playwright 已通过真实浏览器验证模拟产品 A 的质量查询、SSE 结果、图表、证据、管理员
  隔离和窄屏主路径。服务端与业务数据仍是 M2 Mock/内存边界，不冒充生产集成。

## M4：嵌入式助手与多宿主 SDK

状态：完成并通过退出门禁，详细工程证据见 [M4 验收报告](acceptance/milestones/m4-acceptance-report.md)。

- 已实现 `assistant-sdk` 的 React 组件/Hook 与原生 JavaScript API，统一支持
  `mount/open/close/updateContext/getState/destroy` 以及 floating/drawer/inline 展示模式。
- 嵌入与独立 Web 默认主色 `#1677ff`（`DEFAULT_ASSISTANT_COLOR_PRIMARY`）；SDK 可通过
  `theme.colorPrimary` 覆盖，并同步 Ant Design `ConfigProvider` 与 `--assistant-brand` CSS 变量。
- React、原生 JavaScript 和跨域 iframe 三种宿主复用 M3 Chat Core、Transport 与同一
  Agent Server；SDK 不暴露 Deep Agents/LangGraph 内部对象。
- Host Context 使用既有 `RawHostContext` 白名单；每次提交前捕获一次服务端 Snapshot，
  页面从 X 切换到 Y 只影响下一次 Run，身份和权限仍由服务端凭证建立。
- `iframe-bridge` 对 `origin/source/channelId/version/requestId/schema` 全部校验；URL 和
  `postMessage` 不传长期 Token，一次性票据绑定目标 Origin、60 秒过期且消费后立即失效，
  只换取 5 分钟临时凭证。
- iframe 悬浮入口已收敛为 Assistant Embed 提供的声明式 `assistant-loader.js`：Loader 在
  Shadow DOM 中统一维护按钮、固定面板、iframe 与 Bridge；A/B 业务工程仅在入口 HTML
  声明地址、Ticket Endpoint 和初始 Context，不再复制助手模板或 CSS。
- Playwright 已在独立 Origin 上验证 X→Y、SDK 挂载/销毁与 iframe 票据启动；iframe 使用
  sandbox 和 `frame-ancestors`。Vite 开发服务器因 React Refresh 使用 `unsafe-inline`，生产
  部署必须改为构建产物并使用 nonce/hash 的严格 CSP。

M4 仍使用 M2 的 Mock Identity、内存存储、离线 Fake Model 和模拟 Adapter；未宣称真实产品
SDK 发布、生产 IdP 委派或生产 CSP/域名白名单已上线。

## M5：独立部署与系统验收

状态：完成开发与离线系统验收；生产依赖替换和真实业务联调仍是明确上线前置条件，详见
[M5 验收报告](acceptance/milestones/m5-acceptance-report.md)。

- 已提供 A/B 两套独立环境样例；同一 Agent Server 组合分别只批准 Product A 或 Product B
  Adapter，端口、密钥注入、插件目录、Store 与 Checkpointer 边界独立。
- A/B 使用不同原始 API 字段，但对外注册相同的两项标准 Capability；系统测试验证质量分数、
  单位、聚合、缺失日期、Partial、业务对象与 Evidence 语义一致。
- 已验证跨实例 Session 不可见、对象拒绝、Context 服务端归一化与固定 Snapshot、Evidence
  范围/方法/来源，以及当前内存存储在进程重启后不恢复的真实边界。
- 未安装 Provider 的标准能力改为不可重试 `UNSUPPORTED`，避免把不支持误报为临时故障；
  HTTP Provider 超时新增自动化验证。
- 已提供部署、插件接入、升级、回滚和可观测性清单；没有恢复用户已删除的 GitHub Actions。

本阶段的 A/B 业务 API、Identity、模型调用和持久化仍为 Mock/离线或配置样例。生产上线前必须
接入企业 IdP、真实业务 API、独立持久化 Repository、官方持久化 Checkpointer、密钥管理、
指标告警和严格 CSP；因此“M5 工程退出门禁通过”不等同于“生产上线批准”。

## M5 后：双产品可演示样例

状态：已完成真实 DeepSeek + iframe 双产品演示增强，不改变 M5 架构范围和生产边界。

当时所有可执行演示工程集中到根目录 `demo/`；V2.2 已整体迁移到独立
`E:\Deep-Agents-AI-Assistant-Demo` 仓库，正式 `apps/`、`packages/` 不再混放产品演示页面、
共享演示壳、测试模型入口或演示启动脚本。架构规定的 Adapter 契约样例仍保留在
`adapters/`，由 Demo Server 作为已批准插件加载。

- 新增 Product A 数据质量运营台与 Product B 数据资产驾驶舱，分别以独立 Web、Agent
  Server、iframe Assistant 端口和批准插件运行；Product A 宿主采用 React + Ant Design，Product B 宿主采用 Vue 3 + Element Plus + Vite，两者共享 Assistant SDK、Chat Core、
  Transport 和标准 Capability Contract。
- 两套页面提供不同品牌、业务指标、对象列表和活动信息，并把当前订单/客户对象通过宿主
  Context 传入助手；工具结果展示标准指标、Partial 限制与 Evidence。
- 根命令 `pnpm demo` 一次启动八个进程（A/B 双产品 + 嵌入式助手 + 独立 Web）；端口就绪后自动打开浏览器，可用 `DEMO_OPEN_BROWSER=0` 关闭；Windows 下使用父进程与心跳监控，启动器退出后
  自动清理子进程。
- 交互式演示缺少 DeepSeek Key 时明确失败，不提供离线回退。Mock Identity 和模拟业务数据始终明确展示，未把真实模型调用描述为真实企业数据集成。
- 仓库已移除 Vitest/Playwright 自动化测试与 `tests/capability-contract-testkit`；`deepagentsjs/` 子树保持独立，未改动其测试配置。
- A/B 页面均通过固定 Origin、一次性票据和 channelId 校验的 iframe Bridge 挂载助手；宿主右下角固定按钮按需展开悬浮助手窗，不占用业务页面布局且不随页面滚动；助手头部与输入区固定，中间消息区独立滚动，页面对象切换只更新后续 Run 的 ContextSnapshot。

历史操作流程已迁至 `E:\Deep-Agents-AI-Assistant-Demo\docs\dual-product-demo-guide.md`。进入真实客户演示前仍需按目标产品替换
企业 IdP、业务 API、模型与持久化驱动，并完成目标环境的安全配置和联调。

## 容器部署目录

状态：已提供 `deploy/` 打包与 Compose 运行方式。身份、业务数据和会话存储仍是 Mock/内存实现。

- `pnpm pack:deploy` 构建 Server、独立 Web、iframe Embed，以及 `adapters/` 中每个带 `plugin.json` 的适配器，产物写入 `deploy/out/`。
- 一个 Compose 项目通过 `PLUGIN_ID` 把一个插件打进 Agent Server 镜像；A/B 使用不同项目名、端口和批准插件。
- 容器内 `PLUGINS_DIR=/opt/assistant/plugins`。`ASSISTANT_REQUIRE_READY_PLUGINS=1` 时，批准插件未进入 `ready` 会拒绝启动。
- 不恢复跨进程会话，也不把容器启动等同于生产上线。

## E0：插件化能力扩展决策与回归基线

状态：完成并通过退出门禁，详细证据见 [E0 验收报告](acceptance/evolution/e0-acceptance-report.md)。

- 新增 ADR-022，确定“稳定 Core + 可信动态 Capability Contract 注册”的混合模型；平台标准能力与部署私有能力分层治理。
- 标准命名空间由平台保留；私有能力使用 `<organization>.<domain>.<action>`，组织前缀需要部署批准。
- 首个动态契约版本只允许可信 Local Plugin Bundle 和 `read` 风险能力；HTTP Provider 只能实现已注册契约，不允许远端临时定义 Tool Schema。
- Manifest V1 至少保留一个迁移周期；Contract、Provider 和 Skill 后续必须 staging 校验并原子提交，冲突失败关闭。
- 恢复根 `pnpm test`，使用 Node 22 内置测试运行器固定当前 Catalog、A/B Adapter、Manifest V1、Tool Factory、权限与插件安全行为，无新增测试框架依赖。
- E0 未修改运行时契约、Plugin SDK、Manifest Schema、Agent Runtime 或 Deep Agents 装配；动态注册从 E1 开始实施。

## E1：开放 Capability SDK 与动态 Catalog

状态：完成并通过退出门禁，详细证据见 [E1 验收报告](acceptance/evolution/e1-acceptance-report.md)。

- Core 与 Plugin SDK 公开通用 `defineCapability()`；`implementCapability()` 改为接受任意满足 `CapabilityContract` 的契约，同时由具体 Zod Schema 保留输入、输出类型推导。
- `CapabilityCatalog` 增加带来源信息的 `register/registerMany`；批量注册先完整校验后提交，重复 `id + version` 不覆盖且不留下部分注册。
- 动态私有契约校验 ID、SemVer、描述、Zod Schema、权限名、风险、来源 ID 和批准命名空间；平台保留命名空间拒绝私有注册，E1 仅允许 `read` 风险。
- 现有 `standardCapabilityContracts` 仍以平台来源注入，Manifest V1、A/B Adapter、Capability Executor 与 Tool Factory 的既有路径保持兼容。
- 新增编译期类型推导探针和 6 项运行时回归，覆盖未知新能力、原子冲突回滚、非法来源/命名空间/风险/Schema、孤立 Provider 失败关闭和 Tool 名冲突。
- E1 不加载 Plugin Bundle 自带契约，不修改 Manifest 协议或 Deep Agents Agent Loop；Bundle 事务式装载属于 E2。

## E2：Plugin Bundle V2 与事务式装载

状态：完成并通过退出门禁，详细证据见 [E2 验收报告](acceptance/evolution/e2-acceptance-report.md)。

- 新增 Manifest V2：可信 Local Bundle 可声明私有命名空间、Contract 来源、权限、风险和可选 Skill 目录；Manifest V1 Local/HTTP 继续兼容。
- Plugin SDK 的 `AssistantPlugin` 可导出 `contracts`；Runtime 对 Manifest、运行时 Contract 和 Provider 集合执行一致性检查后再装载。
- 部署必须显式批准插件 ID、命名空间和权限；V2 动态私有能力仅允许 `read`，平台 Contract 引用必须匹配 Catalog 来源和元数据。
- Catalog 与 Capability Registry 注册均返回可回滚租约。Provider 冲突、初始化失败或健康失败会撤销本 Bundle 的 Contract/Provider，不留下半注册状态。
- 入口和 Skill 目录必须位于插件真实根目录内，拒绝绝对路径、路径逃逸和符号链接；Skill 本阶段只验证并记录，不装配给 Agent。
- 插件状态诊断增加 Manifest 版本、命名空间、Contract 来源、权限、风险、失败阶段和错误码。
- E2 集成测试覆盖安装/移除、动态 Tool 执行、权限拒绝、事务回滚、批准策略、Skill 路径和声明不一致；E0/E1 回归保持通过。

## E3：Plugin Skill 自动发现与 Tool 关联

状态：完成并通过退出门禁，详细证据见 [E3 验收报告](acceptance/evolution/e3-acceptance-report.md)。

- Manifest V2 Skill 支持声明所需 Capability、配置和凭证；路径字符串保持兼容。Skill frontmatter、目录名、整个目录树、内容大小、符号链接和内容哈希均在插件代码装配前验证。
- Plugin Skill Registry 只收录依赖满足的 Skill；缺 Tool/配置/凭证时记录排除原因。同名 Skill 固定拒绝覆盖，冲突 Bundle 的 Contract、Provider 与 Skill 一并回滚。
- 跨插件 Tool 依赖必须由部署显式批准；`SKILL.md allowed-tools` 不能超出 Manifest 关联。凭证门禁仅检查引用是否可用，不读取或记录密钥。
- Agent Server 将可用 Skill 复制为隔离的只读启动快照，并通过 `deepagents@1.14.2` 官方 `skills` 与 `FilesystemBackend` 参数装配；当前 Agent/Run 不受安装目录后续变化影响，仍要求重启生效。
- Skill 文本和外部引用被明确视为不可信；Skill 不授予权限，也不是 Evidence。E3 回归验证无权限调用仍由 Capability Executor 返回 `FORBIDDEN`。
- E3 使用临时本地 Bundle、Mock Provider 和存在性回调验证机制，未连接真实业务 API、企业凭证库或真实模型；不宣称生产集成完成。

## E4：标准能力包拆分与现有 Adapter 迁移

状态：完成并通过退出门禁，详细证据见 [E4 验收报告](acceptance/evolution/e4-acceptance-report.md)。

- `core/capability` 已收敛为 `@assistant/capability-core`，只保留通用契约、Catalog、Registry、Executor、Policy、Evidence 和 Audit；具体业务能力迁移到 `@assistant/capability-data-map` 与 `@assistant/capability-data-quality`。
- 独立 `@assistant/capability-contracts` 包保留旧聚合导出和 `createStandardCapabilityCatalog()`，兼容至 E5 后首个发布周期，最早在下一次 breaking release 移除。
- Product A/B Adapter 直接依赖领域标准包；原有搜索与质量趋势 ID、版本和结果语义保持兼容，并新增 `data_map.get_object_metadata@1.0.0`。
- 元数据查询在 Adapter 内执行对象级与字段级授权；无权字段在进入模型上下文前移除，部分可见返回 `partial + FIELD_ACCESS_RESTRICTED + Evidence`，warning/Evidence 不泄露字段值。
- 两个标准能力包各自提供共享 Provider 契约套件；E4 专项测试验证 A/B 标准输出一致、未绑定 Provider 返回 `UNSUPPORTED`、同版本冲突和单位冲突失败关闭。
- E0～E4 共 30 项测试以及 `lint`、`typecheck`、`build` 均已通过；命令均按用户要求由用户逐条手动执行。
- E4 仍使用 Mock 业务数据与授权引用，未连接真实产品字段权限 API、生产 IdP 或真实 Evidence Repository。

## E5：系统验收、发布流程与文档收口

状态：完成并通过工程阶段退出门禁，详细记录见 [E5 验收报告](acceptance/evolution/e5-acceptance-report.md)。

- 新增可生成的 Manifest V2 模板，包含私有 Contract、Provider、Skill、发布元数据、README 和
  契约测试入口；普通私有能力无需修改 Core、Agent Server、Agent Runtime 或 UI。
- 新增可信本地发布工具，对插件 ID、命名空间、权限、入口 SHA-256 和配置版本执行批准校验，
  支持版本化安装、兼容升级、禁用、回滚与非敏感诊断；不提供远程下载、市场或热加载。
- 升级默认保留旧 `id@version`，配置迁移由安装前受审查步骤完成；兼容或哈希校验失败时不会
  切换 active 版本，工具不会执行 Bundle 自带迁移代码或读取密钥。
- E5 回归使用真实临时发布目录验证 A/B 独立安装相同标准能力与不同私有能力；Provider、身份、
  业务数据和 Evidence Repository 仍为 Mock，不冒充生产集成。
- `test:e5`、E0～E5 全量回归、lint、typecheck 和 build 均已由用户在仓库根目录逐条执行并
  确认通过；首次 lint 暴露的未实例化模板依赖解析问题已修复并复验。

## E5 后：标准业务领域目录归位

状态：完成并通过质量门禁。

- `@assistant/capability-data-map` 与 `@assistant/capability-data-quality` 的包名、版本、契约和
  对外导出保持不变，物理目录迁移到 `domains/data-map`、`domains/data-quality`。
- `packages/` 继续只承载平台 SDK、Runtime、Transport 与 UI；`domains/` 承载跨产品复用的
  标准业务语义；Adapter 仍只负责产品 API 到领域契约的映射。
- Workspace、lockfile importer、E4/E5 测试物理路径和架构文档已同步调整，没有权限、Context、
  Evidence 或运行协议变化。
- 用户在仓库根目录完成 workspace 重新链接；`pnpm test`、`pnpm lint`、`pnpm typecheck`、
  `pnpm build` 均通过。

## AG-UI 1.0 协议 POC

状态：完成并通过工程阶段退出门禁，详见 [AG-UI POC 验收报告](acceptance/evolution/ag-ui-poc-acceptance-report.md)；尚未接入网络端点或 CopilotKit。

- 新增 ADR-024，明确 AG-UI 只作为 Agent 交互事件兼容基线，不替换 Gateway、Session/Run、ContextSnapshot、Evidence、权限和事件重放边界。
- `@assistant/contracts` 锁定 `@ag-ui/core@1.0.3`，把旧 `AssistantEvent` 纯函数、确定性投影为 AG-UI 1.0 生命周期、文本、Tool、Subagent 和取消事件。
- Evidence 与受控 View 使用严格校验的企业 `CUSTOM` 事件；Tool 投影只返回公开状态，不包含参数、原始业务结果或 Runtime Context。
- 新增 `tests/ag-ui-poc/projection.test.mjs`，覆盖标准 Schema、消息生命周期、Tool 敏感数据不出站、企业 Custom Schema、取消和重放确定性。
- 现有 SSE、Transport、ChatStore、Runner 和 Shell 尚未切换；CopilotKit 仍只是后续可选 Adapter/Shell，不是核心依赖。
- 用户已在仓库根目录手动执行 `pnpm test:ag-ui-poc`、`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 并确认全部通过。

## AG-UI 双协议端点与 ChatAgentPort

状态：完成并通过工程阶段退出门禁，详见 [AG-UI 双协议端点验收报告](acceptance/evolution/ag-ui-endpoint-acceptance-report.md)；尚未切换默认 ChatStore 或引入 CopilotKit。

- 新增 `/api/v1/runs/{id}/ag-ui/events`，与旧 `/events` 并存并读取同一个持久 `AssistantEvent` 日志；创建 Run 的响应同时返回两个事件地址。
- 新端点复用 Bearer 认证、用户/租户 Run 归属、限流、`no-store` 和安全错误响应；跨用户仍返回不泄漏资源存在性的 `NOT_FOUND`。
- AG-UI 投影游标包含源事件 ID 与子事件序号。服务端在发送 200 前校验游标，并重建投影状态，支持从同一源事件展开的 `TEXT_MESSAGE_START` 与 `CONTENT` 之间精确恢复。
- `assistant-transport` 新增 `ChatAgentPort<TEvent>`、`AssistantChatAgentPort` 和 `AgUiChatAgentPort`；Shared Chat Core 已依赖旧事件端口抽象，但运行行为未切换。
- 新增 `tests/ag-ui-endpoint/endpoint.test.mjs`，覆盖完整事件流、敏感字段不出站、子事件级重连、非法游标、跨用户 Run 和 AG-UI 客户端端口。
- 用户已在仓库根目录手动执行 `pnpm test:ag-ui-endpoint`、`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 并确认全部通过；Lint 首次发现的问题修复后已复验通过。

## AG-UI 标准命令入口

状态：完成并通过工程阶段退出门禁，详见 [AG-UI 标准命令入口验收报告](acceptance/evolution/ag-ui-command-acceptance-report.md)；尚未引入 CopilotKit。

- 新增 `POST /api/v1/ag-ui`，以官方 AG-UI 1.0 `RunAgentInput` Schema 接收命令，并通过既有 AgentService 创建受控、持久且幂等的 Run。
- `threadId` 必须指向当前用户和租户的活动 Session；ContextSnapshot 引用必须经 `forwardedProps.enterprise-assistant.contextSnapshotId` 提供并再次鉴权。
- AG-UI `context/state` 不构成授权；客户端 Tool 与非文本内容返回受控 `4xx`，不进入 Agent Runtime。
- 返回流继续读取同一 AssistantEvent 日志；公开生命周期使用客户端 `runId` 保持 AG-UI 调用一致性，服务端 Run ID 仍由平台生成。
- 新增 `tests/ag-ui-command/command.test.mjs`，覆盖标准输入流、Context/State 伪造不生效、Tool/多模态/resume 拒绝、快照与 Session 越权和未认证请求。
- 用户已在仓库根目录手动执行 `pnpm test:ag-ui-command`、`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 并确认全部通过。

## CopilotKit 可选 Shell Spike

状态：完成并通过工程阶段退出门禁；详见
[CopilotKit 可选 Shell Spike 验收报告](acceptance/evolution/copilotkit-shell-spike-acceptance-report.md)。

- 独立应用位于 `apps/copilotkit-shell-spike`，不加入 `assistant-ui` 核心依赖，也不替换默认 Ant Design X Shell。
- 锁定 `@copilotkit/react-core@1.79.1` 与 `@ag-ui/client@1.0.3`；CopilotKit 1.79.1 内置
  `@ag-ui/client@1.0.2`，两者协议版本均为 `1.0`；专项测试覆盖直接客户端协议调用，Vite 构建
  覆盖 CopilotKit v2 入口与其内置客户端的实际打包。
- 页面先通过既有 `AssistantApiTransport` 创建受治理 Session 与 ContextSnapshot，再以
  `forwardedProps.enterprise-assistant.contextSnapshotId` 调用 `POST /api/v1/ag-ui`；身份头只保存在
  当前内存实例，不写入 URL 或浏览器持久存储。
- 仅使用官方开发用途的 `agents__unsafe_dev_only` 注册本地 Agent；不使用 CopilotKit Cloud/Runtime，
  不注册客户端 Tool，不接管身份、权限、Context、Evidence 或持久 Run。
- CopilotKit STOP 通过标准 `HttpAgent.abortRun()` 中止 AG-UI HTTP 流；Agent Server 将该流的提前
  取消映射到创建流时已认证 principal 对应的内部 durable Run，不信任客户端 `runId`。
- 新增 `test:copilotkit-spike`，验证官方 `@ag-ui/client@1.0.3` 和 CopilotKit 1.79.1 内置客户端
  版本约束；Vite 构建验证 CopilotKit 前端入口可打包，直接 AG-UI 客户端测试验证相同受治理端点。
  默认 Ant Design X Shell 与 Shared Chat Core 未修改。
- Spike Vite 构建已通过，但 CopilotKit Chat 主产物约 `2,036.77 kB`（gzip `586.36 kB`），并带出
  大量 Markdown/代码高亮动态资源；在完成 bundle 预算、按需能力和真实加载性能评估前，不满足默认
  Shell 替换条件。
- 2026-10-21 已确认 `pnpm test:copilotkit-spike`、`pnpm test`、`pnpm lint`、
  `pnpm typecheck` 与其前置 `pnpm build` 全部通过。

## CopilotKit Shell 真实浏览器验收

状态：完成并通过本轮浏览器验收，详见
[CopilotKit Shell 浏览器验收报告](acceptance/evolution/copilotkit-shell-browser-acceptance-report.md)。

- 使用正式 `createApiHandler`、`AgentService`、Mock Identity、ContextService 和内存 Store 启动
  本地浏览器 fixture；仅 Agent Runner 回复为确定性 Mock，不调用真实模型或外部业务 API。
- 真实浏览器确认页面创建 Session/ContextSnapshot 后进入 `LINK READY`，CopilotChat 用户消息经
  `POST /api/v1/ag-ui` 返回并渲染助手文本。
- 从业务用户 A 切换到业务用户 B 后，业务对象、Session ID 与 Snapshot ID 均变化，未复用前一
  身份的客户端绑定；浏览器控制台无业务错误，仅有 Lit 开发模式提示。
- 当前环境没有 Python Playwright，因此本轮使用内置浏览器自动化完成，尚未形成可在 CI 重复执行
  的端到端测试；fixture 已保留在 Spike 测试目录，且不进入生产 Server。

## AG-UI durable run 取消桥接

状态：完成本阶段实现并通过定向门禁，详见
[AG-UI durable run 取消桥接验收报告](acceptance/evolution/ag-ui-cancel-acceptance-report.md)。

- `POST /api/v1/ag-ui` 返回的 SSE 被提前取消时，服务端调用现有 `AgentRunner.cancel`，使浏览器
  `HttpAgent.abortRun()` 不只停止本地读取，也取消持久运行。
- 取消只使用服务端创建的内部 Run ID 与请求认证后的 principal；AG-UI 客户端 `runId` 不参与
  定位或授权，内部 Run ID 不写入公开事件或响应头。
- Node HTTP 适配层监听响应提前关闭并取消对应 Web Stream；正常完成的响应不会触发取消。
- GET `/runs/{id}/events` 与 `/runs/{id}/ag-ui/events` 仍是可重连读取流，读取端断开不会改变
  Run 状态。
- `test:ag-ui-command` 新增真实本地 HTTP 断连场景，断言取消落到内部 Run、主体为原认证用户，
  且客户端提供的 `runId` 不能选中服务端资源。

## Ant Design X Shared Chat Core 默认切换 AG-UI

状态：完成并通过工程阶段退出门禁，详见
[Shared Chat Core AG-UI 切换验收报告](acceptance/evolution/ag-ui-shared-chat-core-acceptance-report.md)。

- `assistant-ui` 的单一 ChatStore 已从私有 `AssistantEvent` reducer 切换到 AG-UI 1.0，覆盖文本、
  Tool、Subagent、成功/失败/取消，以及严格校验的 Evidence/View 企业 `CUSTOM` 事件。
- 独立 Web 与 React/JavaScript/iframe SDK 默认使用 `AgUiChatAgentPort`；Ant Design X 继续负责
  Bubble、Sender、ThoughtChain 和受控 View 渲染，未引入 CopilotKit 核心依赖或第二套状态源。
- 默认路径仍先通过企业 REST 创建 Session、ContextSnapshot 和持久 Run，再读取同一 Run 的
  `/api/v1/runs/{id}/ag-ui/events`；状态查询、显式取消、Evidence 再鉴权和精确游标重连保持不变。
- 新增 `test:ag-ui-chat-core`，覆盖完整事件归一化、投影子事件去重、Tool 原始结果不进入 UI、
  Evidence/View、安全终态和失败码展示。
- 真实 Chromium 已验证默认 Ant Design X Shell 提交消息并显示 AG-UI 回答，切换模拟身份后会话
  视图清空且业务对象变化，浏览器控制台无错误。测试使用确定性 Mock Runner，不冒充真实模型。
- 2026-10-21 已确认 `pnpm test`、`pnpm lint`、`pnpm typecheck` 及其全量 `pnpm build` 通过；
  CopilotKit 构建在受限沙箱内首次遇到 pnpm store `os error 5`，允许读取同一本地 store 后原命令
  复跑通过。

## AG-UI Human-in-the-loop

状态：完成标准 interrupt/resume 最小闭环并通过专项自动化与真实浏览器验收，详见
[AG-UI HITL 验收报告](acceptance/evolution/ag-ui-hitl-acceptance-report.md)。

- Agent Runner 从 LangGraph checkpoint 读取受控 `approval` interrupt，持久登记 `approval.required`、
  `run.interrupted` 和 Run `interrupted` 状态；AG-UI 投影输出标准 interrupt outcome。
- `POST /api/v1/ag-ui` 接受单个标准 `resume[]`；默认 Ant Design X Shell 使用
  `POST /api/v1/runs/{id}/resume`，两者复用同一恢复、鉴权、幂等和续跑逻辑。
- 待确认记录绑定用户、租户、Session、原 Run 与 ContextSnapshot；跨用户返回 `NOT_FOUND`，开放
  interrupt 未解决前拒绝普通新 Run，重复确认不会触发第二次执行。
- Shared Chat Core 新增确认卡、确认/拒绝状态、续跑消息和刷新恢复。普通模型文本不能生成按钮。
- 当前一次只支持一个开放 interrupt；真实写 Capability 尚未加入，本轮以受控 Mock Graph/Runner
  验证协议和 UI，不能视为任何生产写业务已接通。

## 统一 Runtime Policy 与可信回答发布

状态：实现完成并通过专项自动化，完整质量门禁待用户执行；详见
[Runtime Policy 验收报告](acceptance/evolution/runtime-policy-acceptance-report.md)。

- 新增严格 Zod 校验的 `AgentRuntimePolicy`，由应用组合根解析一次并同时注入 Agent Runtime 与
  Runner；未知字段、零值和负数失败关闭。
- 显式配置 `SummarizationMiddleware`：40,000 tokens 触发、保留最近 24 条消息、摘要输入最多
  32,000 tokens，避免 DeepSeek/OpenAI-compatible 模型依赖自动 Profile 推断。
- 使用官方 `toolCallLimitMiddleware` 与 `modelCallLimitMiddleware` 设置每 Run 12 次 Tool、10 次
  Model 的默认预算；Runner 统一使用策略中的 recursion limit 和 120 秒总超时。
- 模型正文改为严格发布：先缓冲 Draft，再验证非空、长度、业务结果 Evidence、Evidence 当前
  Run/主体归属；partial 由服务端追加限制声明，验证后才产生正文事件和持久消息。
- 增加稳定失败码及 `test:runtime-policy` 专项测试。用户首次执行发现 LangChain Middleware 参数
  声明在当前 Zod 4 类型组合下收窄为 `never`/`undefined`；已增加限定在第三方边界的无 `any`
  类型适配，并于 2026-10-21 由用户重新执行 `pnpm test:runtime-policy` 确认通过。根级 `lint`、
  `typecheck`、`build` 与全量 `test` 仍待用户验证。

## V2.1 外部 MCP 业务能力架构（已被 V2.2 取代）

状态：历史迁移设计；详见
[V2.1 外部 MCP 业务能力架构](architecture-v2.0/21-V2.1-外部MCP业务能力架构.md) 和 ADR-026。

- 目标边界已调整：主仓成为受治理的 MCP Host；`E:\Deep-Agents-AI-Assistant-MCP` 负责业务
  Domain、产品 API Adapter、业务 Prompt/Resource 和 MCP Server 模板。
- 边界进一步收紧为“业务能力全部由 MCP 提供，平台只做平台能力”：主仓不再作为业务 Capability
  Catalog 或标准业务契约发布方，不解释业务字段、口径、权限名称和业务错误；这些全部迁入 MCP 仓。
- 主仓继续拥有身份、ContextSnapshot、Session/Run、平台 Policy、Evidence 安全传输/Audit、
  Runtime Policy 和回答发布门禁；业务结果信封、业务错误和业务权限语义由 MCP 仓维护，外部 MCP
  不能通过 Tool 描述、Prompt 或参数自授予权限。
- 生产目标使用带 TLS 的 Streamable HTTP；stdio 只用于开发/测试。具体 SDK 版本、协议版本、
  import path 和认证 API 必须在 MCP-1 依据实际官方包锁定和验证。
- 主仓 `adapters/`、`domains/`、业务 `skills/`、`templates/`、Plugin SDK/Runtime、Capability
  兼容包和 E0–E5 旧回归链路已删除。Agent Server 不再扫描本地插件，只接收平台侧已批准的 MCP
  Tools。生产 MCP 连接管理尚未完成，因此仍不能宣称生产业务 Tool、认证或 Evidence 链路已完成。
- 主仓 `demo/` 已迁移到独立 `E:\Deep-Agents-AI-Assistant-Demo` Git 仓库，不再属于主仓 workspace、
  lint 范围或根脚本；Demo 通过显式本地 `link:` 消费相邻平台仓的 SDK/Context/UI 包。
- MCP-1 将以 `data_quality.get_trend` 做最小只读垂直切片，并要求新旧路径对同一测试向量双跑一致；
  完成 MCP-2～MCP-4 门禁后才允许切换默认路径和清理旧目录。

## MCP-1：外部业务 MCP 最小只读切片

状态：实现完成，依赖安装和真实门禁待用户执行；详见
[MCP-1 验收报告](acceptance/evolution/mcp-1-acceptance-report.md)。

- MCP 仓锁定官方 `@modelcontextprotocol/server@2.3.1` 与 Client `2.3.1`；V2.2 重构后由根级
  `product-a-mcp` 提供 Product A 自有只读 Tool（质量趋势、样本行、表元数据、资产检索）、`api/clients` 微服务 Mock 分层、stdio 入口和 in-memory 测试。
- 主仓新增 `@assistant/mcp-client-runtime`，不依赖 `domains/*`、Adapter 或业务结果类型；它只发现
  MCP JSON Schema、计算 SHA-256、匹配 Server/Tool/风险/Schema 批准并转换为 LangChain Tool。
- 未批准、Schema 漂移、非只读、缺少结构化结果、Tool 错误和超大结果均失败关闭；远端错误正文不
  直接进入模型上下文；LangChain 取消信号透传给 MCP SDK，并有 in-memory Handler 取消测试。
- Agent Server Composition Root 已支持从可信进程配置连接一个或多个本地 stdio MCP，逐 Server
  发现 Tool、校验固定 Schema 摘要与只读风险、拒绝额外未批准 Tool，并将全部批准 Tool 合并注入
  Deep Agents。任一连接、漂移或 Tool 名冲突会关闭整组连接并拒绝启动。
- 跨仓 stdio 测试已改为验证 Agent Server 的实际装配入口；另有多 MCP 测试验证同一 Runtime
  同时挂载 Product A/B。根据 ADR-027，平台仍不解析业务字段，也不做 A/B 业务结果等价比较。
- 当前数据、授权和 Evidence 都是明确 Mock。Streamable HTTP、委托身份、业务 Evidence 重新鉴权、
  连接池/重连和 Product B 真实系统接入属于 MCP-2。
- Product A/B 原有 stdio 协议与主平台 Client Runtime 测试已由用户确认通过；新增 Composition Root、
  多 MCP 装配及完整仓库 pnpm 门禁待用户重新执行。

## V2.2：一系统一 MCP

状态：S1 结构纠偏已实现，真实门禁待用户执行；详见
[V2.2 一系统一 MCP 架构](architecture-v2.0/22-V2.2-一系统一MCP架构.md) 和 ADR-027。

- 取消跨 Product A/B 的通用业务能力层，不再建设共享 Domain、标准 Capability、统一业务结果或
  产品 Adapter。每个业务系统独占一个完整 MCP 项目。
- `Deep-Agents-AI-Assistant-MCP` 根目录新增 `product-a-mcp/`，Schema、业务规则、MCP Server、stdio
  入口和测试均位于该项目；原 `domains/data-quality`、`servers/demo-product-a` 文件已移除。
- Product A Tool 不再发布 `capabilityId/contractVersion/requiredPermission` 跨系统元数据；平台只批准
  Server、Tool、Schema 摘要和通用风险。
- 主仓 stdio 集成测试不再导入 Capability Catalog、Plugin Runtime、旧 Adapter 或 Product A 业务字段。
  主仓业务目录、Plugin/Capability 运行机制和旧回归测试已清理；workspace、Server Composition Root、
  管理状态 API、Web 状态页与部署打包均切换为 MCP 术语和平台边界。
- MCP 仓已新增独立 `product-b-mcp/`，提供 `list_open_work_orders` 只读 Tool，用于验证挂载不同业务
  能力；它不依赖 Product A Schema。当前工单数据、站点授权和 Evidence 均为 Mock。

## PEX-1：受治理的平台扩展最小闭环

状态：完成并通过工程阶段退出门禁；用户已确认 `pnpm install`、标准
`pnpm test:platform-extensions` 8/8、`pnpm test:ag-ui-hitl`、`pnpm lint`、全量 `pnpm test` 和
`pnpm typecheck`（包含全量 build）全部通过。详见
[平台扩展机制](architecture-v2.0/23-平台扩展机制.md)、ADR-028 和
[PEX-1 验收报告](acceptance/evolution/platform-extension-pex-1-acceptance-report.md)。

- 新增 `@assistant/platform-extension-runtime`，提供严格 Manifest、版本与规范化摘要批准、已安装包名
  限制、不可变启动 Snapshot、声明/实现一致性校验和全局 Tool 名冲突防护。
- Platform Tool 首版只允许 `read` 风险，权限从服务端 Runtime Context 的 `permissionScopes` 逐调用
  校验；模型参数不能提供主体、租户或权限。非 JSON 和超大结果失败关闭。
- Skill 使用扩展根目录内相对路径，拒绝路径逃逸、符号链接、异常文件和超限内容；校验 SHA-256 后
  复制到 OS 临时目录。Agent Backend 只读 `/skills/**`，拒绝其他读取和所有写入。
- 新增独立目录 `extensions/platform-diagnostics`，以 `@assistant/platform-diagnostics-extension` 包提供
  平台扩展边界说明 Tool/Skill，不包含 Product A/B/C 业务语义；具体 Extension 不再混入 `packages/*`。
- Agent Server Composition Root 合并批准的 MCP Tool 与 Platform Tool，并把 Skill 启动快照交给
  官方 Deep Agents `skills`/`FilesystemBackend`/`permissions` 公共参数；未改写 Agent Loop。
- 新增 `test:platform-extensions` 专项测试。Codex 使用现有锁定依赖和临时只读模块解析完成定向 TypeScript
  静态诊断，并直接执行 Node 专项回归 8/8 通过；该诊断不替代用户执行 `pnpm install` 后的标准
  `pnpm test:platform-extensions`、lint、typecheck、build 或全量测试门禁。
- 2026-10-23 用户执行 `pnpm install` 成功：识别 16 个 workspace projects，resolved 868、reused 817、
  downloaded 0、added 0；`pnpm-lock.yaml` 已记录新增 Platform Extension workspace 依赖。registry 请求
  耗时和 `hast@1.0.0` deprecated 均为非阻断 warning。
- 2026-10-23 用户执行 `pnpm test:platform-extensions` 成功：Runtime 与参考 Extension 构建完成，Node
  专项测试共 8 项，pass 8、fail 0、cancelled 0、skipped 0、todo 0，测试时长约 710 ms。
- 2026-10-23 用户首次执行 `pnpm lint` 时，既有 `.mjs` 测试因 ESLint 未声明 Node/Web 全局变量产生
  9 个 `no-undef`；统一补充测试环境 globals，并移除 4 个已冗余的文件级 global 注释后，Codex 使用
  ESLint 底层入口验证 0 error，用户重跑标准 `pnpm lint` 确认通过。
- 2026-10-23 按“一 Extension 一独立目录”收紧工程结构：参考实现从 `packages/*` 迁移到
  `extensions/platform-diagnostics`，新增 `extensions/*` workspace 类型；包名、Manifest 摘要和部署
  批准契约未变。Codex 直接执行 ESLint、该 Extension TypeScript 检查和 Node 专项回归，均通过，专项
  测试 8/8；迁移后的标准 pnpm 门禁待用户复验。
- 2026-10-23 用户全量测试发现既有 AG-UI HITL 假 Agent 在恢复后返回空流，触发可信答案校验
  `ANSWER_EMPTY`，导致 2 项恢复测试失败。测试夹具已改为在恢复后输出合法 `AIMessage`，未放宽空答案
  失败关闭、所有权或幂等校验；Codex 直接复验 HITL 2/2 通过。用户随后重新执行 `pnpm install`、
  `pnpm test:ag-ui-hitl` 和全量 `pnpm test`，三条命令均确认通过。
- 2026-10-23 用户执行 `pnpm typecheck` 成功；该根脚本先完成全量 `pnpm build`，再执行各 workspace
  TypeScript `--noEmit` 检查，因此 build 与 typecheck 两项门禁均通过。

## AG-UI Host Action：回答后联动 Product A 页面

状态：实现完成，本次变更的标准 pnpm 门禁和真实浏览器联动待用户验证；详见
[AG-UI Host Action 验收报告](acceptance/evolution/ag-ui-host-action-acceptance-report.md) 和 ADR-029。

- 新增通用 `host.navigate` 契约与 `action.navigate` Assistant View；只允许不透明 target、展示 label
  和有限标量参数，明确拒绝 URL、路径、HTML 与脚本。
- 新增独立 `extensions/host-navigation` Platform Extension。Runner 只从该 Extension 的固定 Tool Result
  提取 Host Action，普通模型文本、其他 Platform Tool 和 MCP Tool Result 不能生成导航按钮。
- ContextSnapshot 可携带宿主声明的可用动作；模型只能在用户明确提出导航需求时选择其中 target，动作
  描述与 Tool 输出均不作为授权依据。Runner 再次匹配 Snapshot target 并采用宿主声明的 label，拒绝
  未声明 target 和模型自定义文案。
- Shared Chat Core、SDK 与 iframe Bridge 已贯通按钮点击回调；Bridge 继续校验 origin、source、channel、
  requestId 与 Schema，不直接执行导航。
- Product A 的 target → hash route allowlist 位于独立 Demo 仓，平台主仓不包含其路由表。真实业务 API、
  业务 Schema、业务权限和页面数据继续由对应 MCP 与原系统负责。
- Codex 已完成 contracts、context、agent-runtime、agent-server 与 Product A 定向 TypeScript 检查，并
  直接执行 Product A allowlist Node 测试 2/2 通过；新增 workspace 链接、标准专项测试、lint、全量
  typecheck/build 和浏览器验收仍待用户通过 pnpm 启动链路验证。
- `start-local-development.ps1` 已把 `host-navigation@1.0.0` 的固定 Manifest 摘要批准注入 Product A
  Agent Server；一键启动不再依赖用户手工设置 `PLATFORM_EXTENSIONS`。默认只启动 Product A 全链路
  （Agent Server `3411`、Embed `5511`、Demo `5411`、独立 Web `5173`），在 Agent Server OpenAPI 就绪后再
  拉起依赖服务；`-IncludeProductB` 可选启动 B。Product B 与 SDK Host 未声明对应宿主动作，因此不自动
  加载该 Extension。
- 修复 pnpm 隔离布局下的 Extension 解析：bare package 由 Agent Server Composition Root 从自身依赖
  解析后交给通用 Loader 校验，避免 Runtime 包目录无法看到消费方 Extension；专项测试覆盖真实已安装
  `host-navigation` 包解析。
# Product A YAML 接口配置补充（2026-10-24）

- 对应 ADR-034：MCP 仓 Product A 增加启动时 YAML 快照加载、受限 Schema 校验、单次只读网关请求和自动 Tool 注册；一文件可声明多个 Tool。现有四个代码 Tool 保留。
- 配置目录使用 PRODUCT_A_MCP_TOOLS_DIR，网关使用 PRODUCT_A_GATEWAY_BASE_URL；不包含跨系统业务契约或主平台自动批准能力。
- 配置接口要求可信认证主体与租户，不使用 Mock 身份回退，不合成 Evidence。真实 IdP/网关凭证及对象、行、列权限仍需业务环境验收。
- 新增 YAML 接入文档、非默认启用示例与 Mock 测试；仅执行测试文件语法检查和 diff 空白检查，未安装新依赖，未运行 pnpm、类型检查、构建或测试。退出门禁待用户验证。

# Demo Product A 业务接口补充（2026-10-24）

- ADR-035：Demo Product A 增加独立 Spring Boot 业务 API，提供授权目录搜索、表详情与只读批量评分，前后端共用 catalog.json。MCP config/tools 增加三个 demo_ 查询，旧 examples/mock 已删除。
- 现有本地 Docker 编排增加 product-a-api；用户预先 Maven 构建 JAR，pack:local 复制产物与 MCP 配置，并仅为固定 YAML 摘要批准三个明确 Tool。平台 Runtime 不持有业务契约。
- 最终业务授权由 Demo API 执行；验签恢复主体，按既有演示用户隔离对象。数据仍为演示数据，不生成可信 Evidence。
- 本轮 mvn -B test：4项测试通过，覆盖真实 Spring Controller、认证、权限、分页和参数校验；Compose config 与脚本语法检查通过。新增前端 JSON 引入、MCP 本地 HTTP 配置、Docker 打包与全链路 pnpm 门禁待用户验证，未运行任何 pnpm 命令。
# 真实 Product A 与独立部署迁移（2026-10-24，ADR-036）

- 新 Product A 保留自身前后端与 MySQL/Nacos；MCP business 模式只注册五个真实只读 YAML Tool，原有 Mock 不暴露到这套部署。旧 ADR-035 演示 API 与旧 demo_ 配置已退出当前流程。
- 平台增加配置化 HTTP profile 认证与内存凭证仓；Cookie 保持 HttpOnly，iframe 通过一次性 ticket 获得短期平台凭证，业务 JWT 不进入 Session/Graph/Tool 参数。MCP 每次恢复真实业务主体，原网关执行原系统授权；输出按字段白名单裁剪。
- 三个 Compose 项目为 assistant-product-a、assistant-mcp、assistant-agents；最后一组仅 postgres、agent-server、assistant-web、assistant-embed。构建、批准产物和生命周期分仓，主仓只做平台与部署配置。
- 按用户明确授权清理旧 assistant-local 六容器、旧演示 PostgreSQL 卷和主仓三个旧业务部署副本，保留旧治理业务容器及其他项目。用户随后明确授权 Codex 执行后续命令至部署完成，本次依此执行 pnpm 门禁。
- 实际验证：Maven 九模块 package 成功，网关身份头防伪测试通过；Govern/Portal 类型检查和生产构建成功；MCP 类型检查、Product A 20项及Product B 6项测试、pack:product-a 成功；平台 lint、typecheck（含build）、全量test、身份专项3项和pack:local通过。真实部署YAML解析及固定摘要批准已验证。
- 三个 Compose 项目共15个容器启动完成，up --wait成功；verify-local检查页面/API和未登录401通过。真实网关身份、数据源、工作台接口返回200且success=true；平台恢复管理员身份，MCP ready且五Tool approved。
- 真实模型验收Run `29a58200-99ff-4bc8-b25d-b33d6b93fa65` completed，工作台查询返回新数据库的八项0计数，未填充Mock数据或Evidence。该接口验收使用仅在内存中签发的短期管理员测试JWT，不代表图形验证码登录已经验收；浏览器中业务登录页和独立助手未登录提示已确认，用户仍需登录检查嵌入交互。

## 真实页面与宿主导航修复（ADR-037）

- 已修复ES Module加载方式、门户公网模板baseURL/假Token、页面fake接口及Nginx内部端口重定向。活跃业务路由改用真实查询组件；当前仅提供查询展示，不宣称已完成原模板的写入表单。
- Product A MCP移除旧四个Mock实现及假身份回退，扩为七个真实YAML工具；源码和发布文件清单明确隔离协议测试夹具。平台Compose传入host-navigation固定批准，Product A声明五个真实路由动作白名单。
- 管理端、门户真实验证码登录与工作台展示已在浏览器完成；嵌入助手真实查询、action.navigate生成及实际跳转数据源管理通过，成功Run为`56550c45-8d16-4794-b04e-d5fc8c081d52`。MCP11/11、Product B7/7、平台扩展10/10、AG-UI导航4/4、宿主回归4/4通过，双前端类型/构建、平台lint、打包和部署检查通过。
- 数据仍为空；首次浏览器模型请求失败、同会话重试成功，根因未从现有安全日志确定。完整证据、边界和执行命令见[真实导航验收记录](acceptance/evolution/product-a-real-navigation-2026-10-24.md)。
