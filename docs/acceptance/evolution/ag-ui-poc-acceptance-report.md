# AG-UI 1.0 协议 POC 验收报告

日期：2026-10-20  
状态：通过工程阶段退出门禁

## 实现范围

- 锁定 `@ag-ui/core@1.0.3` 与 AG-UI 协议版本 `1.0`。
- 将现有持久化 `AssistantEvent` 纯函数、确定性投影为 AG-UI 标准运行、文本、Tool、Subagent
  与取消事件，不改变既有事件源。
- Evidence 与受控 View 使用版本化企业 `CUSTOM` 事件和严格 Zod Schema。
- 企业 metadata 保存稳定投影 ID、源事件 ID、序列、Session 和原协议版本，支持确定性重放。
- Tool 投影仅公开完成或失败状态，不传输参数、原始业务结果、可信 Runtime Context 或
  LangGraph raw event。
- 新增 ADR-024，确定 AG-UI 是兼容事件基线，CopilotKit 仅能作为后续可选 Shell/Adapter。

## 测试覆盖

- 文本 `START/CONTENT/END` 与 Run 成功终态。
- Tool 生命周期以及模拟敏感业务结果不出站。
- Evidence/View 企业 Custom 事件及未批准扩展字段失败关闭。
- AG-UI `cancelled` outcome。
- 相同持久事件重复投影结果完全一致。
- E0～E5 全量插件、权限、Capability、Evidence 与发布回归保持通过。

## 已执行命令

- `pnpm test:ag-ui-poc`：通过。
- `pnpm test`：通过。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过。

以上 pnpm 命令均由用户于 2026-10-20 在仓库根目录手动执行并确认结果。

## 真实与未实施边界

本阶段真实验证 AG-UI 官方 TypeScript Schema、编译类型、确定性映射和安全出站约束。现有网络
端点、`assistant-transport`、ChatStore、Runner 与 Shell 未切换为 AG-UI；尚未实现标准
`HttpAgent` 端点、`ChatAgentPort` 或 CopilotKit Shell，也未改变 Mock Identity、模拟业务数据、
内存存储及生产集成边界。

## 结论

AG-UI 1.0 协议 POC 满足当前工程退出门禁。下一阶段如获明确授权，应先实现同一持久事件源的
双协议端点和 `ChatAgentPort`，验证认证、取消、`Last-Event-ID` 重放、ContextSnapshot、Evidence
与 iframe 回归后，再评估默认切换或引入 CopilotKit。
