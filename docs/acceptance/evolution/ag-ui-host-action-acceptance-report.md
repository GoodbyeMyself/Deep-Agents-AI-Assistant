# AG-UI Host Action 联动验收报告

> 日期：2026-10-23  
> 决策：ADR-029  
> 状态：实现完成，标准 pnpm 门禁和真实浏览器联动待用户验证

## 目标

验证模型回答后可以生成受控 AG-UI 导航按钮，用户点击后由 Product A 跳转到自己的内部页面，同时不让
模型、平台扩展或 MCP 获得直接控制 URL、业务路由与授权的能力。

## 已实现链路

1. Product A 将当前允许的 Host Action 描述写入 ContextSnapshot。
2. 模型在用户明确要求打开页面时调用已批准的 `host-navigation` Platform Tool。
3. Agent Runner 仅从 `platform_host-navigation_present_navigation` Tool Result 提取严格校验的
   `host.navigate`，持久化
   `view.created/action.navigate`，再投影为 AG-UI View。
4. Shared Chat Core 渲染按钮；点击后 SDK/iframe Bridge 发送 `assistant.host-action`。
5. Product A 只接受本地 allowlist 中的 target，并通过既有 hash router 导航。

## 安全与边界

- Host Action Schema 不接受 URL、路径、HTML 或脚本，只接受不透明 target 和有限标量参数。
- 普通模型文本、业务 MCP Tool Result 不能生成导航 View。
- Runner 只接受固定 ContextSnapshot 中已声明的 target，并用宿主声明的 label 覆盖模型文案。
- iframe 消息沿用 origin、source、channelId、requestId 和 Schema 校验。
- Product A 是 target → route 的最终解释者；未知目标和 URL 形态输入拒绝。
- 导航不是授权。页面数据、后续 Tool 与业务操作仍由 Product A、对应 MCP 和原业务 API 鉴权。
- 主仓专项测试使用通用 `demo.issue-list`，不持有 Product A 的路由契约；产品键仅存在于 Demo 仓。

## 自动化验证

- 主仓：`pnpm test:ag-ui-host-action`，覆盖模型 Tool 输出到可重放 AG-UI View，以及 iframe Schema 对
  URL target 的拒绝。
- 主仓：`pnpm test:platform-extensions`，覆盖 Extension 结果结构及 URL target 拒绝。
- Demo 仓：`pnpm test`，覆盖 Product A allowlist 正向映射、未知 target 和 URL target 拒绝。

上述 pnpm 命令按仓库纪律必须由用户执行；本报告生成时尚未取得本次变更后的真实结果。

Codex 已直接调用仓库现有 TypeScript 编译器，确认 contracts、context、agent-runtime、agent-server 与
Product A 定向检查通过；直接执行 Product A allowlist Node 测试为 2/2 通过。新增 workspace 依赖尚未由
用户重新执行 `pnpm install` 建立链接，因此 iframe/SDK/Extension 的标准构建、根 lint 和主仓专项测试
仍以用户执行结果为准。

## 浏览器验收

1. 为 Agent Server 配置并批准 `@assistant/platform-host-navigation-extension`，启动平台与 Product A。
2. 在 Product A 助手中输入：“回答后给我一个按钮，带我去问题工单页面”。
3. 预期正文后出现“打开问题工单”按钮，且点击前宿主页面不跳转。
4. 点击按钮，预期 Product A hash 变为 `#/issues` 并显示问题工单页面。
5. 构造未知 target 或 URL target 时，预期宿主不导航且不执行任何脚本。

真实模型是否选择调用 Tool 受模型行为影响；协议自动化使用确定性 Fake Agent，只证明平台链路，不冒充
真实模型或真实业务 API 集成成功。
