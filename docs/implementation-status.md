# 实施状态

更新日期：2026-10-14

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
- 已实现 React Shared Chat Core：会话切换、增量文本、公开 Tool/Subagent 进度、取消、
  Evidence 二次解析，以及 text/metric/table/chart.line/references 受控 View Renderer。
- 独立 Web 已提供业务对象选择语义、用户会话管理、模型/能力状态和管理员插件状态；
  普通用户与管理员页面按服务端权限分离。
- 使用 React 19、Ant Design 6.6.6、Ant Design X 2.9.0 与 Vite 8.3.4；未直接消费
  LangGraph raw chunk，未进入 M4 React/JS/iframe SDK。
- Playwright 已通过真实浏览器验证模拟产品 A 的质量查询、SSE 结果、图表、证据、管理员
  隔离和窄屏主路径。服务端与业务数据仍是 M2 Mock/内存边界，不冒充生产集成。
