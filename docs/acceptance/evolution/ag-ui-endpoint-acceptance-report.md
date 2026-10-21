# AG-UI 双协议端点与 ChatAgentPort 验收报告

日期：2026-10-21  
状态：通过工程阶段退出门禁

## 实现范围

- 新增 `GET /api/v1/runs/{id}/ag-ui/events`，与原有 AssistantEvent SSE 端点并存，并从同一份
  持久事件日志生成 AG-UI 1.0 投影。
- Run 创建响应同时返回旧事件地址和 AG-UI 事件地址；现有调用方与默认 ChatStore 行为保持不变。
- AG-UI 游标包含源事件 ID 与投影子事件序号，支持在同一源事件产生的多个 AG-UI 事件之间精确续传。
- 新端点复用既有认证、租户与用户归属检查、限流、安全响应头和错误语义。
- `assistant-transport` 新增通用 `ChatAgentPort<TEvent>`、旧协议端口别名和 `AgUiChatAgentPort`；
  Shared Chat Core 改为依赖端口抽象，但尚未切换默认事件协议。

## 测试覆盖

- 已授权 Run 的完整 AG-UI 生命周期流。
- `TEXT_MESSAGE_START` 与同源 `TEXT_MESSAGE_CONTENT` 之间的精确恢复。
- 非法或过期投影游标在开始 SSE 响应前失败关闭。
- 未认证请求返回 `401`，跨用户读取返回不泄漏资源存在性的 `404`。
- Tool 原始敏感结果和 `authorizationRef` 不进入 AG-UI 出站事件。
- `AgUiChatAgentPort` 可消费新增端点；原 AssistantEvent 端点与现有回归保持通过。

## 已执行命令

- `pnpm test:ag-ui-endpoint`：通过。
- `pnpm test`：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过。

以上 pnpm 命令均由用户在仓库根目录手动执行并确认结果。Lint 首次发现枚举解析、AG-UI metadata
边界及 Node 测试全局声明问题，修复后于 2026-10-21 重新执行并通过。

## 真实与未实施边界

本阶段真实验证了双协议 HTTP/SSE 端点、持久事件重放、子事件级游标、认证归属、安全出站和客户端
端口。运行存储、身份、业务数据与外部系统仍沿用当前测试环境或 Mock 边界；尚未实现 AG-UI 标准
`HttpAgent` POST 语义，未切换默认 ChatStore，也未引入 CopilotKit。AG-UI 不替代 Gateway、Session、
Run、ContextSnapshot、Evidence 或服务端权限边界。

## 结论

AG-UI 双协议端点与 ChatAgentPort 满足本阶段工程退出门禁。后续如获明确授权，可独立评估将
AG-UI 端口接入可选 Shell，或开展 CopilotKit 兼容性 Spike；不得将 CopilotKit 反向渗透为核心
Runtime、权限或持久化契约。
