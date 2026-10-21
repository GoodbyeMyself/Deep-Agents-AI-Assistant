# CopilotKit Shell 浏览器验收报告

日期：2026-10-21  
状态：通过本轮浏览器验收

## 验收范围

- 在真实 Chromium 页面加载隔离的 CopilotKit Shell，而不是仅测试 AG-UI 客户端类。
- 验证页面启动时通过正式企业 API 创建 Session 和 ContextSnapshot。
- 验证 CopilotChat 提交用户消息并渲染 `POST /api/v1/ag-ui` 返回的助手文本。
- 验证 Mock 身份切换会重建 Session、Snapshot 和本地 `HttpAgent` 绑定。
- 检查浏览器控制台错误及窄视口下主要内容的可访问性。

## 测试环境与真实性边界

浏览器测试使用 `apps/copilotkit-shell-spike/tests/browser-fixture-server.mjs`。Fixture 复用正式
`createApiHandler`、`AgentService`、`ContextService`、`MockIdentityProvider`、
`InMemoryAgentStore` 和 AG-UI 投影链路；只有 Agent Runner 的回答是确定性 Mock。测试未读取真实
模型 Key，未调用外部模型、Copilot Cloud 或真实业务 API。

当前环境未安装 Python Playwright，无法使用仓库外 `webapp-testing` 技能推荐的 Python 自动化
脚本。本轮改用内置 Chromium 自动化完成真实交互；该结果是人工驱动的浏览器验收证据，不冒充
已纳入 CI 的 Playwright 回归。

## 验收结果

- 首屏进入 `LINK READY`，同时显示非空 Session ID、Snapshot ID 和
  `POST /api/v1/ag-ui` 端点。
- 输入“请总结订单数据集的质量趋势”后，页面保留用户消息并渲染 Mock 助手回答：
  “订单数据集质量趋势稳定，当前模拟质量分为 96%。”
- 从“业务用户 A”切换到“业务用户 B”后，页面对象更新为“客户数据集”，Session 与 Snapshot
  标识都发生变化，证明 React Provider/HttpAgent 绑定已重新创建。
- 浏览器控制台没有应用错误；唯一警告为 Vite 开发环境中的 Lit dev-mode 提示。
- 当前窄视口中聊天区和边界卡片按响应式规则纵向排列，输入区仍可访问。

## 仍未验证或未完成

- 未测试真实模型的长时间流式输出、Tool/Subagent 视觉呈现或 Evidence 卡片，因为这些能力不在
  本 Spike 的 CopilotKit 映射范围内。
- 未验证浏览器断网恢复和 AG-UI 游标续传。durable run cancel 已通过真实本地 HTTP 连接的中止
  测试验证，但尚未形成浏览器 STOP 点击的 CI 回归。
- 未形成 CI 浏览器测试。若推进产品化，应先决定是否重新引入受控 Playwright 工具链，并补充
  多身份越权、慢流、中断、Evidence 和性能预算场景。

## 结论

真实浏览器证据支持“AG-UI 作为 Shell 与 agent-runtime 之间标准事件契约，CopilotKit 作为隔离
可选前端实现”的可行性判断。它不改变此前结论：当前 CopilotKit 方案受 bundle 体积、生产授权和
未自动化浏览器回归限制，不应替换默认 Ant Design X Shared Chat Core。
