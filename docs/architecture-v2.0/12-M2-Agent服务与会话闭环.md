# M2 · 企业可信执行闭环：Gateway、Context、Policy、Evidence、Session、SSE（V2.0）

> 依赖：M1 插件与契约已验证。重点不是做通用 Agent 平台，而是**企业权限继承、数据来源可信和可审计执行**。

## 工作包

### M2-T01 最小 API、身份与 Session

- 建立身份验证（可使用 Mock Identity Provider 测试，但生产必须接入实际身份源）；仅服务端确认 `userId`、租户和权限信息。
- 创建 Session/Thread/Run、历史查询、删除/归档和同一部署内对话恢复；不引入跨产品 Session Federation。
- Agent 模型配置只实现当前实例可用的基础管理，密钥存凭证管理器，浏览器不获取明文。

### M2-T02 ContextSnapshot

- 定义 RawHostContext（不可信）、NormalizedBusinessContext（业务语义）、TrustedExecutionContext（服务端身份）。
- 页面数据由当前安装的 Context Adapter 转成标准 Context；若未安装插件/当前独立 Web，则通过标准对象选择建立 Context。
- 每次 Run 固定 ContextSnapshot ID；页面改变不影响已在执行的 Run；工具执行时重新查权限。

### M2-T03 Policy 强制校验

- Capability 执行入口校验授权、对象访问约束、参数白名单；业务 HTTP Client 将已验证主体传至原平台 API 继续校验。
- 必须设计越权拒绝测试：篡改 `object.id`、猜测其他会话 ID、字段越权、伪造前端 `permissions`。
- 加入标准拒绝结果，不将内部异常堆栈直接送给模型和 UI。

### M2-T04 Evidence 与 Result

- 工具返回 `status / data / scope / evidence / warnings`；保留数据对象、来源记录标识、统计区间、口径、收集时间、追踪 ID。
- 证据引用跳转由服务端再次鉴权，不直接暴露长期源地址或敏感记录。
- Data insufficient、口径不一致、可能原因必须与已证实结论区分。

### M2-T05 Deep Agents Runner 和 SSE

- Session/Run API 统一使用当前安装插件产生的 Tools；真实 Streaming 事件通过 Event Bridge 转成平台 SSE。
- 事件含 `eventId/sequence/runId/sessionId/type/schemaVersion`；至少提供 run.started, message.delta, tool.started/completed, evidence.added, view.created, run.completed/failed。
- 用户取消、网络中断与最后状态可观测；若完整游标重放无法在 M2 完成，须明确降级和后续补齐门禁。

### M2-T06 审计与检查点

- 存储使用者、能力、数据范围、证据、状态与模型配置版本；屏蔽密钥与敏感值。
- Checkpointer 与业务 Session 分开管理；后端鉴权保护读写。

## 退出条件

一个已认证的模拟用户在模拟产品中查询数据质量，成功生成带范围/时间/来源的回答；越权请求被工具执行层和业务 Adapter 共同拒绝；同一部署会话可继续。输出真实/Mock 边界及负面测试报告。

## Codex 指令

```text
只执行 M2-T01~T06，先读 04、06、08、09、12 和 M1 报告。
优先端到端权限继承、上下文快照和证据引用，不做多渠道网关或复杂模型商城。
每个 Tool Call 必须通过统一执行器和真实可测的授权拦截。
跑越权和敏感字段测试，生成 M2 验收报告后停止。
```
