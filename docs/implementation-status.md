# 实施状态

更新日期：2026-10-20

## M0：工程初始化与框架验证

状态：完成并通过退出门禁，质量门禁结果见 `m0-acceptance-report.md`。

- 已建立 pnpm workspace、TypeScript strict、ESLint、Prettier、Vitest、CI 与环境变量样例。
- 已建立实际可运行的 `core/capability`、`packages/agent-runtime`、
  `apps/agent-server`，未创建后续阶段空壳包。
- 已锁定并执行 `deepagents@1.14.2`，验证 Tool、Runtime Context、Skills、
  Subagent、FilesystemBackend、MemorySaver 和 Streaming。
- 已建立最小质量趋势标准契约示例，为 M1 Tool Factory 对接保留产品无关边界。
- 已使用 `deepseek-flash` 完成真实模型 Tool Calling 烟测：Agent 调用标准质量趋势 Tool、
  收到 ToolMessage，并基于合成 Evidence 生成最终回答；凭证未写入源码或日志。
- M0 未提前实现 Plugin SDK/Loader/Registry；这些能力已在后续 M1 完成。

当前仍未宣称 Agent Server HTTP API、真实业务权限、页面上下文、Evidence 解引用或前端
已经上线。这些属于后续明确阶段；插件自动挂载已在 M1 完成。

## M1：插件自动发现与双 Adapter POC

状态：完成并通过退出门禁，质量与安全证据见 `m1-acceptance-report.md`。

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

状态：完成 M2 阶段退出门禁，详细证据与 Mock 边界见 `m2-acceptance-report.md`。

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

状态：完成并通过退出门禁，详细证据与页面预览见 `m3-acceptance-report.md` 和
`m3-preview.png`。

- 已实现 `assistant-transport`：Bearer REST、Fetch SSE、事件 Schema 校验、断流续传、
  `Last-Event-ID`、事件去重与终态查询，不把网络断开伪装为完成。
- 已实现 React Shared Chat Core：会话切换、增量文本、取消、Evidence 二次解析，以及
  text/metric/table/chart.line/references 受控 View Renderer。公开 Tool/Subagent 进度使用
  Ant Design X ThoughtChain 归属到对应助手消息；执行中展开、完成后折叠，支持显式展开/收起；
  步骤同时展示业务名称、标准 Capability 标识和公开协作 namespace，但不展示模型私有推理。
- 消息列表使用 Ant Design X `Bubble.List`，模型正文使用 `@ant-design/x-markdown@2.9.0`
  解析 CommonMark/GFM；流式状态传递给渲染器，原始 HTML 转义为文本并保留 XSS 净化边界。
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

状态：完成并通过退出门禁，详细证据与页面预览见 `m4-acceptance-report.md` 和
`m4-preview.png`。

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
`m5-acceptance-report.md`。

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

所有可执行演示工程已集中到根目录 `demo/`；正式 `apps/`、`packages/` 不再混放产品演示页面、
共享演示壳、测试模型入口或演示启动脚本。架构规定的 Adapter 契约样例仍保留在
`adapters/`，由 Demo Server 作为已批准插件加载。

- 新增 Product A 数据质量运营台与 Product B 数据资产驾驶舱，分别以独立 Web、Agent
  Server、iframe Assistant 端口和批准插件运行；Product A 宿主采用 React + Ant Design，Product B 宿主采用 Vue 3 + Element Plus + Vite，两者共享 Assistant SDK、Chat Core、
  Transport 和标准 Capability Contract。
- 两套页面提供不同品牌、业务指标、对象列表和活动信息，并把当前订单/客户对象通过宿主
  Context 传入助手；工具结果展示标准指标、Partial 限制与 Evidence。
- 根命令 `pnpm demo` 一次启动六个进程；Windows 下使用父进程与心跳监控，启动器退出后
  自动清理子进程。
- 交互式演示缺少 DeepSeek Key 时明确失败，不提供离线回退。Mock Identity 和模拟业务数据始终明确展示，未把真实模型调用描述为真实企业数据集成。
- 仓库已移除 Vitest/Playwright 自动化测试与 `tests/capability-contract-testkit`；`deepagentsjs/` 子树保持独立，未改动其测试配置。
- A/B 页面均通过固定 Origin、一次性票据和 channelId 校验的 iframe Bridge 挂载助手；宿主右下角固定按钮按需展开悬浮助手窗，不占用业务页面布局且不随页面滚动；助手头部与输入区固定，中间消息区独立滚动，页面对象切换只更新后续 Run 的 ContextSnapshot。

完整操作流程与边界见 `dual-product-demo-guide.md`。进入真实客户演示前仍需按目标产品替换
企业 IdP、业务 API、模型与持久化驱动，并完成目标环境的安全配置和联调。

## 容器部署目录

状态：已提供 `deploy/` 打包与 Compose 运行方式。身份、业务数据和会话存储仍是 Mock/内存实现。

- `pnpm pack:deploy` 构建 Server、独立 Web、iframe Embed，以及 `adapters/` 中每个带 `plugin.json` 的适配器，产物写入 `deploy/out/`。
- 一个 Compose 项目通过 `PLUGIN_ID` 把一个插件打进 Agent Server 镜像；A/B 使用不同项目名、端口和批准插件。
- 容器内 `PLUGINS_DIR=/opt/assistant/plugins`。`ASSISTANT_REQUIRE_READY_PLUGINS=1` 时，批准插件未进入 `ready` 会拒绝启动。
- 不恢复跨进程会话，也不把容器启动等同于生产上线。

## E0：插件化能力扩展决策与回归基线

状态：完成并通过退出门禁，详细证据见 `e0-acceptance-report.md`。

- 新增 ADR-022，确定“稳定 Core + 可信动态 Capability Contract 注册”的混合模型；平台标准能力与部署私有能力分层治理。
- 标准命名空间由平台保留；私有能力使用 `<organization>.<domain>.<action>`，组织前缀需要部署批准。
- 首个动态契约版本只允许可信 Local Plugin Bundle 和 `read` 风险能力；HTTP Provider 只能实现已注册契约，不允许远端临时定义 Tool Schema。
- Manifest V1 至少保留一个迁移周期；Contract、Provider 和 Skill 后续必须 staging 校验并原子提交，冲突失败关闭。
- 恢复根 `pnpm test`，使用 Node 22 内置测试运行器固定当前 Catalog、A/B Adapter、Manifest V1、Tool Factory、权限与插件安全行为，无新增测试框架依赖。
- E0 未修改运行时契约、Plugin SDK、Manifest Schema、Agent Runtime 或 Deep Agents 装配；动态注册从 E1 开始实施。

## E1：开放 Capability SDK 与动态 Catalog

状态：完成并通过退出门禁，详细证据见 `e1-acceptance-report.md`。

- Core 与 Plugin SDK 公开通用 `defineCapability()`；`implementCapability()` 改为接受任意满足 `CapabilityContract` 的契约，同时由具体 Zod Schema 保留输入、输出类型推导。
- `CapabilityCatalog` 增加带来源信息的 `register/registerMany`；批量注册先完整校验后提交，重复 `id + version` 不覆盖且不留下部分注册。
- 动态私有契约校验 ID、SemVer、描述、Zod Schema、权限名、风险、来源 ID 和批准命名空间；平台保留命名空间拒绝私有注册，E1 仅允许 `read` 风险。
- 现有 `standardCapabilityContracts` 仍以平台来源注入，Manifest V1、A/B Adapter、Capability Executor 与 Tool Factory 的既有路径保持兼容。
- 新增编译期类型推导探针和 6 项运行时回归，覆盖未知新能力、原子冲突回滚、非法来源/命名空间/风险/Schema、孤立 Provider 失败关闭和 Tool 名冲突。
- E1 不加载 Plugin Bundle 自带契约，不修改 Manifest 协议或 Deep Agents Agent Loop；Bundle 事务式装载属于 E2。

## E2：Plugin Bundle V2 与事务式装载

状态：完成并通过退出门禁，详细证据见 `e2-acceptance-report.md`。

- 新增 Manifest V2：可信 Local Bundle 可声明私有命名空间、Contract 来源、权限、风险和可选 Skill 目录；Manifest V1 Local/HTTP 继续兼容。
- Plugin SDK 的 `AssistantPlugin` 可导出 `contracts`；Runtime 对 Manifest、运行时 Contract 和 Provider 集合执行一致性检查后再装载。
- 部署必须显式批准插件 ID、命名空间和权限；V2 动态私有能力仅允许 `read`，平台 Contract 引用必须匹配 Catalog 来源和元数据。
- Catalog 与 Capability Registry 注册均返回可回滚租约。Provider 冲突、初始化失败或健康失败会撤销本 Bundle 的 Contract/Provider，不留下半注册状态。
- 入口和 Skill 目录必须位于插件真实根目录内，拒绝绝对路径、路径逃逸和符号链接；Skill 本阶段只验证并记录，不装配给 Agent。
- 插件状态诊断增加 Manifest 版本、命名空间、Contract 来源、权限、风险、失败阶段和错误码。
- E2 集成测试覆盖安装/移除、动态 Tool 执行、权限拒绝、事务回滚、批准策略、Skill 路径和声明不一致；E0/E1 回归保持通过。

## E3：Plugin Skill 自动发现与 Tool 关联

状态：完成并通过退出门禁，详细证据见 `e3-acceptance-report.md`。

- Manifest V2 Skill 支持声明所需 Capability、配置和凭证；路径字符串保持兼容。Skill frontmatter、目录名、整个目录树、内容大小、符号链接和内容哈希均在插件代码装配前验证。
- Plugin Skill Registry 只收录依赖满足的 Skill；缺 Tool/配置/凭证时记录排除原因。同名 Skill 固定拒绝覆盖，冲突 Bundle 的 Contract、Provider 与 Skill 一并回滚。
- 跨插件 Tool 依赖必须由部署显式批准；`SKILL.md allowed-tools` 不能超出 Manifest 关联。凭证门禁仅检查引用是否可用，不读取或记录密钥。
- Agent Server 将可用 Skill 复制为隔离的只读启动快照，并通过 `deepagents@1.14.2` 官方 `skills` 与 `FilesystemBackend` 参数装配；当前 Agent/Run 不受安装目录后续变化影响，仍要求重启生效。
- Skill 文本和外部引用被明确视为不可信；Skill 不授予权限，也不是 Evidence。E3 回归验证无权限调用仍由 Capability Executor 返回 `FORBIDDEN`。
- E3 使用临时本地 Bundle、Mock Provider 和存在性回调验证机制，未连接真实业务 API、企业凭证库或真实模型；不宣称生产集成完成。

## E4：标准能力包拆分与现有 Adapter 迁移

状态：完成并通过退出门禁，详细证据见 `e4-acceptance-report.md`。

- `core/capability` 已收敛为 `@assistant/capability-core`，只保留通用契约、Catalog、Registry、Executor、Policy、Evidence 和 Audit；具体业务能力迁移到 `@assistant/capability-data-map` 与 `@assistant/capability-data-quality`。
- 独立 `@assistant/capability-contracts` 包保留旧聚合导出和 `createStandardCapabilityCatalog()`，兼容至 E5 后首个发布周期，最早在下一次 breaking release 移除。
- Product A/B Adapter 直接依赖领域标准包；原有搜索与质量趋势 ID、版本和结果语义保持兼容，并新增 `data_map.get_object_metadata@1.0.0`。
- 元数据查询在 Adapter 内执行对象级与字段级授权；无权字段在进入模型上下文前移除，部分可见返回 `partial + FIELD_ACCESS_RESTRICTED + Evidence`，warning/Evidence 不泄露字段值。
- 两个标准能力包各自提供共享 Provider 契约套件；E4 专项测试验证 A/B 标准输出一致、未绑定 Provider 返回 `UNSUPPORTED`、同版本冲突和单位冲突失败关闭。
- E0～E4 共 30 项测试以及 `lint`、`typecheck`、`build` 均已通过；命令均按用户要求由用户逐条手动执行。
- E4 仍使用 Mock 业务数据与授权引用，未连接真实产品字段权限 API、生产 IdP 或真实 Evidence Repository。

## E5：系统验收、发布流程与文档收口

状态：完成并通过工程阶段退出门禁，详细记录见 `e5-acceptance-report.md`。

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
