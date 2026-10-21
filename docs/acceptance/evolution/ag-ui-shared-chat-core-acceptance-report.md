# Ant Design X Shared Chat Core 默认切换 AG-UI 验收报告

日期：2026-10-21  
状态：通过工程阶段退出门禁

## 实现范围

- 保留 Ant Design X 作为默认 UI 渲染层，不引入 CopilotKit 核心依赖或第二套聊天状态。
- `assistant-ui` 的 `ChatAction` 和 reducer 改为消费官方 `AgUiEvent`，覆盖文本、Tool、Subagent、
  成功、失败、取消，以及企业 Evidence/View `CUSTOM` 事件。
- 独立 Web 与 Assistant SDK 默认把 `AssistantApiTransport` 包装为 `AgUiChatAgentPort`；React、
  JavaScript 和 iframe 接入继续共享同一 Chat Core。
- 默认路径继续通过企业 REST 创建 Session、ContextSnapshot 和持久 Run，再从同一内部 Run 的
  `/api/v1/runs/{id}/ag-ui/events` 读取确定性投影。`POST /api/v1/ag-ui` 保留给标准客户端与可选
  Shell，不替代默认 Core 的创建 Run 路径。
- `AssistantApiTransport.watchRun` 和旧 `/events` 端点保留为兼容与回滚路径，不在默认 Core 中与
  AG-UI 同时消费。

## 契约与安全验证

- reducer 使用企业投影 metadata 中的子事件游标去重；同一源事件展开的 `START/CONTENT` 不会
  相互覆盖，重放也不会重复追加文本。
- Tool 只渲染公开能力名称和 `completed/failed` 状态，不读取或渲染 Tool 参数、Runtime Context
  或原始业务结果。
- Evidence 与 View 只接受 `enterprise.evidence.added.v1` 和
  `enterprise.view.created.v1`，并再次通过项目 Zod Schema 校验；未知或非法 Custom 事件不进入 UI。
- Session、Run、ContextSnapshot、Evidence、身份和授权仍由原企业 REST/Gateway 边界执行；AG-UI
  metadata、客户端 Context 和客户端 Tool 不构成授权依据。

## 自动化测试

- `pnpm test:ag-ui-chat-core`：3/3 通过，覆盖完整事件归一化、游标去重、取消和失败终态。
- `pnpm test`：通过，包含 E0～E5、AG-UI POC/端点/命令、Shared Chat Core 和 CopilotKit Spike。
- `pnpm lint`：通过，0 error、0 warning。
- `pnpm typecheck`：通过；其前置全量 `pnpm build` 同时通过，25 个 workspace 类型检查通过。
- 首次在受限沙箱执行全量测试时，CopilotKit Vite 构建读取 pnpm store 文件遇到 Windows
  `os error 5`；未修改依赖或降低门禁，在允许读取同一本地依赖目录后原命令复跑通过。

## 真实浏览器验收

- 使用正式 `createApiHandler`、`AgentService`、Mock Identity、ContextService、内存 Store 和默认
  `assistant-web`，只有 Runner 回答为确定性 Mock。
- Chromium 中提交“请总结订单数据集的质量趋势”后，默认 Ant Design X Shell 显示经 AG-UI
  投影返回的助手文本，执行状态正常结束。
- 从业务用户 A 切换到业务用户 B 后，前一用户消息不再显示，当前业务对象变为“客户数据集”；
  浏览器控制台无错误。
- 当前环境没有 Python Playwright，因此本轮使用内置 Chromium 完成浏览器验收，尚未把该操作
  固化为可在 CI 重复执行的浏览器脚本。

## Mock 与生产边界

本阶段没有调用真实模型或外部业务 API。浏览器 Fixture 的 Runner 固定返回验收文本，因此不能用
于验证自然语言回答质量。生产上线仍受企业 IdP、真实业务授权/脱敏、持久 Store/Checkpointer、
代理层断线与取消传播、生产密钥管理和灾备演练约束，这些不是本次事件格式切换的伪完成项。

## 结论

默认 Ant Design X Shared Chat Core 已切换到 AG-UI 1.0 事件语义，并保持企业 REST、持久 Run、
ContextSnapshot、Evidence、权限和回滚边界。该工程阶段通过退出门禁；不自动推进到真实生产部署。
