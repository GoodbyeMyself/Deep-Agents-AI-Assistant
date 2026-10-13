# M3 · React + Ant Design X Shared Chat Core 与独立 Web

> 依赖：M2 Session/Run API、SSE 契约基本稳定。  
> 允许改动：`apps/assistant-web`、`packages/assistant-ui`、`packages/assistant-transport`、`packages/contracts`、UI E2E 测试。

## 1. 成功目标

同一 `ChatWorkspace` 显示标准消息、工具执行状态、Evidence、结构化 Result；独立 Web 有基础后台管理功能；不复制或依赖具体产品 Adapter，也不在浏览器引入 Deep Agents 私有库。

## 2. 工作包

### M3-T01：前端工程

- React/TypeScript/Vite、Ant Design、Ant Design X；核对已锁版本的 `Bubble`、`Sender`、`Conversations`、`ThoughtChain`、`Sources` API。
- 路由、登录态、受控布局、主题 Token、错误边界、加载与空状态。
- 实现 `ChatWorkspace`、`ChatComposer`、`MessageList`、`ExecutionTimeline`、`EvidencePanel`、`ViewRendererRegistry`。

### M3-T02：Assistant Transport

- 按 `09` 实现 Create Session、Create Run、Get Events、Get Messages、Cancel Run。
- 状态粒度：sessionId/runId/messageId/toolCallId；事件递增序列和去重。
- 网络超时/断流重连/刷新恢复/重复 event/错误状态提示；避免 X SDK 和自研 Store 产生双重消息源。

### M3-T03：结构化数据组件

- V1 `text/metric/table/chart.line/references`，采用 Zod 校验受信任 ViewModel。
- 数据质量趋势图只能渲染工具返回的完整/部分数据；`partial` 提供缺口提示。
- Evidence Panel 通过服务端二次鉴权的引用解析 API 展示来源。

### M3-T04：独立 Web 菜单

- 智能对话 + 用户会话管理 + 模型注册/启停/默认配置 + 插件/能力状态（只读即可）。
- Agent 管理可先实现当前配置展示；系统/审计页可先只读基础页，并明确未实现项，不生成虚假操作按钮。
- 管理菜单与服务端权限配合；普通用户无法操作管理员 API。

## 3. UI / 页面验收路径

1. 登录 Demo 用户进入 `/chat`；选择一个业务对象（Standalone 无宿主上下文）。
2. 输入 “查询最近七天质量趋势” → Bubble 流式更新 → Timeline 显示真实工具调用 → 趋势图和证据出现。
3. 刷新页面/切换会话，历史消息恢复正确，Tool 已完成状态不乱跳。
4. 管理员访问模型/插件管理正常；普通用户被拒绝而不是仅隐藏菜单。
5. 无数据、partial、权限错误、模型未配置、网络断开有可理解的反馈。

## 4. 性能、样式和可访问性

- 长消息列表/大表格可滚动；首屏和 Bundle 大小做基本评估，不将管理页面打入将来的 SDK。
- 支持浅色/深色基础主题；移动端窄屏有可用布局。
- 表单标签、输入焦点、键盘打开/关闭、屏幕阅读器可访问性基础检查。
- Markdown 渲染与链接做 XSS 安全测试；业务 ViewModel 不可注入任意 JSX/HTML。

## 5. 验收

- `pnpm typecheck`, `pnpm test`, `pnpm build`，以及主要 Playwright E2E 完成。
- UI 消费的是平台 SSE，未解析 `deepagents` 原生 event 结构。
- 独立 Web 的 Session/Model/Plugins 管理数据来自真实 M2 API，不是写死静态假列表；Demo Mock 环境明确标注。
- 共享聊天不包含管理路由代码；Assistant Shell 可以后续直接复用。

## 6. Codex 阶段指令

> 按 07、09、13、16 和 AGENTS.md，用 React + Ant Design + Ant Design X 实现共享 ChatWorkspace、Transport 和独立 Web，严格对接 M2 契约。先跑 mock/SSE fixture，再联调真实 API。只读或演示功能必须标记清楚，不能伪装已连接后端。覆盖流式消息、重连去重、证据、权限和后台页面的 E2E；完成后停止。
