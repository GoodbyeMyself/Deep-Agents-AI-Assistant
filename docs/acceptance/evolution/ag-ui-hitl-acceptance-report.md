# AG-UI Human-in-the-loop 验收报告

日期：2026-10-21  
状态：标准 interrupt/resume 最小闭环通过；真实写业务未接入

## 实现范围

- LangGraph checkpoint 中符合企业审批 Schema 的 interrupt 被登记为持久待确认记录。
- 原 Run 进入 `interrupted`，AG-UI 投影以
  `RUN_FINISHED.outcome={type:'interrupt', interrupts:[...]}` 结束。
- `POST /api/v1/ag-ui` 支持单个标准 `RunAgentInput.resume[]`；默认 Shell 的
  `POST /api/v1/runs/{id}/resume` 复用同一恢复逻辑。
- Ant Design X Shared Chat Core 展示确认卡，支持确认、拒绝、续跑和刷新恢复。

## 安全与一致性

- 普通助手文本不能生成确认按钮；中断必须来自服务端 checkpoint 并通过 Zod Schema。
- 待确认记录绑定用户、租户、Session、原 Run 与 ContextSnapshot；跨用户访问返回 `404`。
- 开放中断未解决前拒绝普通新 Run；确认使用客户端请求 ID 幂等，同一中断只能解决一次。
- 确认载荷当前只接受 `{approved:true}`，拒绝载荷只接受 `{approved:false}`；不接受任意业务参数。
- Human 确认不替代 Capability Executor 与原业务 API 的实时权限、参数及写入幂等校验。

## 自动化验证

- `pnpm test:ag-ui-hitl`：2/2 通过，覆盖标准 AG-UI resume、LangGraph Command 恢复、归属隔离、
  待确认阻断、幂等与重复确认拒绝。
- `pnpm test:ag-ui-chat-core`：4/4 通过，包含确认卡状态与续跑 reducer。
- `pnpm test:ag-ui-poc`：5/5 通过。
- `pnpm test:ag-ui-command`：5/5 通过。

## 浏览器验收

使用真实 Chromium、正式 Transport/ChatWorkspace 和专用 Mock HITL Runner 验证：

1. 发送消息后出现“需要你的确认”卡片。
2. 点击“确认并继续”后创建续跑 Run，并显示完成回答。
3. 第二次中断后刷新页面，确认卡能够恢复。
4. 点击“拒绝”后显示未执行结果。
5. 浏览器控制台无错误。

## 未验证边界

- 本轮 Mock Runner 不调用真实模型或外部业务写 API，不代表发布、删除或写入业务已完成。
- 当前一次只支持一个开放 interrupt；并行 interrupt 失败关闭。
- 生产持久化仍取决于后续 Store/Checkpointer 驱动，本地验收使用内存 Store。
