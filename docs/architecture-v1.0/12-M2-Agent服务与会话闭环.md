# M2 · Agent Server、Context/Policy/Evidence、Session/Run 与 SSE 闭环

> 依赖：M1 标准契约与自动挂载测试通过。  
> 允许改动：`apps/agent-server`、`core/context|policy|evidence|result`、`platform/model-registry|session-service|agent-registry`、`packages/agent-runtime` Runner/Event Bridge、`packages/contracts`、`tests`、数据库迁移。

## 1. 成功目标

真实服务端 API 可创建 Session/Run，利用可信用户/业务 Context 执行已注册只读 Capability，返回**安全、可追溯、可恢复**的标准 SSE。会话/Checkpoint/Run/Audit/Evidence 有清楚的存储关系。

## 2. 工作包

### M2-T01：Gateway & Auth

- 设计当前部署的身份适配接口 `PrincipalResolver`，测试环境可使用受控 Demo Auth，生产时须由业务认证接入。
- 统一 `traceId`、错误码、用户/租户数据归属；保护 Session、Run、Evidence、管理路由。
- 禁止把浏览器自报 userId/permissions 视为可信主体。

### M2-T02：Context Core

- `RawHostContext` 接口、Zod 白名单/长度限制、Plugin Context Adapter 标准化、服务端填充用户与权限，创建不可变快照。
- 保存 `ContextSnapshot`，保证同一个 Run 绑定单个快照；不同用户不能互用快照。
- Standalone 模式支持无页面上下文或用户选择业务对象。

### M2-T03：Policy / Evidence / Result

- 用真实服务端 `ExecutionContextResolver` 将 Run 映射为当前用户授权；每次 Capability 调用强制执行权限。
- 原平台授权由模拟服务/实际 API 验证，包括对象范围和字段脱敏；不可仅做权限字符串匹配。
- Evidence 从真实 ToolResult/业务响应提取与存储；引用解析接口二次鉴权。
- `partial / insufficient_data / unsupported` 可被前端识别；系统日志保留执行路径但不泄密。

### M2-T04：Session / Checkpoint / Run

- 实现 Session CRUD + `threadId` 映射；模型/Agent 配置运行版本固化。
- 接入与当前 Deep Agents 兼容的持久化 Checkpointer；会话列表元数据与 Checkpoint 分开管理。
- `Run` 状态：queued/running/completed/failed/cancelled/interrupted；同一个 Session 首版使用串行 Run 策略。
- `clientRequestId` 幂等：重复提交只返回已有 Run。

### M2-T05：Agent Factory/Runner/Event Bridge

- 将 M1 工具、Model Registry、Session、Context、Backend 与 Checkpointer 装入 Deep Agent。
- Runner 使用实际运行流，转换为 `AssistantEventV1`；不能解析未经验证的固定 raw 字段位置。
- 持久化 eventId/sequence；实现 SSE 订阅、重放、完成/错误终止、取消与事件游标过期提示。

### M2-T06：模型配置最小管理

- 模型 Provider/ID/凭证引用/能力/默认配置/启停/配置版本。
- 管理员可注册/调整/测试连接；普通用户只能看有权限的可用模型。
- 密钥不出现在 JSON、日志、Agent Prompt、客户端。

## 3. API 与数据

按 `09-API数据模型与事件协议.md` 定义 OpenAPI：`/sessions`、`/runs`、`/context/snapshots`、`/evidence/:ref`、`/models`、`/plugins`、`/capabilities`。  
数据库迁移需要至少创建 Session、Run、Message、ContextSnapshot、Audit、Evidence、ModelConfig、RunEvent，及选定 Checkpointer 所需表。定义索引和归属列。

## 4. 安全/恢复测试

- 用户 A 拿到用户 B Session、runId、threadId、evidenceRef → 拒绝。
- 客户端传假的 `userId=admin` → 忽略；审计记录真实主体。
- 执行后立即切换前端上下文 → 已开始 Run 仍使用旧快照。
- 数据不足/缺字段 → `partial` 和 warnings；模型不将失败说成零值。
- 断开 SSE 并重连 → 事件按 cursor 补发且 UI 可去重；事件过期时返回可操作错误。
- 启动过程模型密钥缺失 → 明确配置错误，不输出 Secret。

## 5. 交付文件建议

```text
apps/agent-server/src/routes/{session,run,context,model,plugin,evidence}.ts
apps/agent-server/src/app.ts
packages/agent-runtime/src/{agent-factory,agent-runner,event-bridge}.ts
core/context/src/...
core/policy/src/...
core/evidence/src/...
core/result/src/...
platform/session-service/src/...
platform/model-registry/src/...
packages/contracts/src/...
migrations/...
openapi/assistant-v1.yaml
```

## 6. 验收门槛

- HTTP 与 SSE 可以端到端调用真实已注册插件能力；证明来源和权限链路。
- 认证授权测试、Schema 测试、会话恢复、持久化、事件重连通过。
- 至少一个 Demo User 的完整 “问题→工具→证据→回答” Trace 可复现。
- 管理 API 具有最小 RBAC，不允许匿名修改模型。
- 真实业务接入尚未完成时使用标注清楚的 Demo Auth/Mock API，不称为生产权限已完成。

## 7. Codex 阶段指令

> 阅读 04、06、08、09、12、16 和 AGENTS.md，以现有 M1 代码为基础开发 Agent Gateway、可信 Context、Policy、Evidence、Session/Run、模型最小配置、SSE 与 Checkpointer。优先实现并测试权限与可恢复性，再补管理接口。保持 Deep Agents 调用方式与 M0 兼容记录一致，不引入跨产品路由和跨实例共享会话。提供接口文档、迁移脚本、测试命令与演示请求；完成后停止。
