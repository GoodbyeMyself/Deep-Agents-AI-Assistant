# AG-UI 标准命令入口验收报告

日期：2026-10-21  
状态：通过工程阶段退出门禁

## 实现范围

- 新增 `POST /api/v1/ag-ui`，使用官方 AG-UI 1.0 `RunAgentInput` Schema 接收命令并返回
  AG-UI SSE 事件。
- `threadId` 只映射到当前用户和租户已有的活动 Session；客户端 `runId` 只作为幂等键和
  公开 AG-UI 生命周期标识，服务端事实 Run ID 仍由平台生成。
- 调用方必须先通过受控 Context API 创建 ContextSnapshot，并通过
  `forwardedProps.enterprise-assistant.contextSnapshotId` 传递引用；服务端再次校验归属。
- 输入只消费最后一条用户文本消息。客户端 Tool、非文本内容、interrupt resume 和非 1.0
  协议版本当前失败关闭。
- `context/state` 不参与身份、权限、Tool 集合或 ContextSnapshot 决策；输出继续来自同一份
  持久 AssistantEvent 日志和既有安全投影。

## 测试覆盖

- 标准 `RunAgentInput` 创建受控 Run，并返回匹配调用方 `threadId/runId` 的生命周期事件。
- 伪造 AG-UI `context/state` 不进入服务端授权结果或出站事件。
- 客户端 Tool、合法多模态内容、interrupt resume 和不兼容协议版本返回受控 `422`。
- 缺失 ContextSnapshot 引用返回 `400`；外部用户快照和跨用户 Session 返回不泄漏资源存在性的
  `404`。
- 未认证请求在解析命令内容前返回 `401`。
- 现有 AG-UI 投影、双协议端点、插件、Capability、Context、Evidence 与 Shell 回归保持通过。

## 已执行命令

- `pnpm test:ag-ui-command`：通过。
- `pnpm test`：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过。

以上 pnpm 命令均由用户于 2026-10-21 在仓库根目录手动执行并确认。专项测试首次使用了不符合
官方 AG-UI Schema 的 `file` 内容类型，修正为合法 `document` 内容后重新执行并通过；产品拒绝
多模态输入的策略未改变。

## 真实与未实施边界

本阶段真实验证标准 AG-UI 输入校验、受控 Run 创建、身份与 ContextSnapshot 归属、幂等映射和
SSE 输出。身份、业务数据和外部系统仍沿用当前测试或 Mock 边界。尚未引入 CopilotKit Runtime、
Cloud 或 React 包；未实现客户端 Tool、interrupt resume、多模态输入以及通过 AG-UI 自身完成
企业 Run 取消。默认 Ant Design X Shell 与 AssistantEvent ChatStore 未切换。

## 结论

AG-UI 标准命令入口满足本阶段工程退出门禁。下一阶段如获明确授权，可创建隔离的 CopilotKit
Shell Spike，以自托管模式验证运行发现、认证头、ContextSnapshot 前置创建、消息流和停止行为；
不得让 CopilotKit 接管企业身份、权限、持久化或 Evidence 契约。
