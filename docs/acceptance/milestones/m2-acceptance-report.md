# M2 开发与验收报告

- 日期：2026-10-14
- 基线：V2.0，M1 Exit Criteria 已通过
- 范围：M2-T01～M2-T06；未进入 M3

## 任务完成情况

| 任务                            | 状态                 | 完成证据                                                                                              |
| ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| M2-T01 最小 API、身份与 Session | 完成                 | Node HTTP `/api/v1`、Mock IdP、Session/Message/Run、归属隔离、幂等、串行、归档/软删除、安全模型元数据 |
| M2-T02 ContextSnapshot          | 完成                 | Raw/Normalized/Trusted 三层契约，服务端身份注入、对象校验、Run 固定 Snapshot                          |
| M2-T03 Policy 强制校验          | 完成                 | 严格 Zod 参数、Capability Policy 对象范围、Adapter 二次业务授权及越权负例                             |
| M2-T04 Evidence 与 Result       | 完成                 | 标准 Result 保持，Evidence 入库、引用句柄、安全解析和再次鉴权                                         |
| M2-T05 Runner 与 SSE            | 完成                 | 官方 Deep Agents message stream → 版本化实时/重放 SSE，工具、子 Agent、View、完成/失败/取消事件       |
| M2-T06 审计与检查点             | 完成（M2 Mock 边界） | 主体/会话/Run/能力/结果/Evidence 审计；Session 与官方 MemorySaver 分离；PostgreSQL 参考迁移           |

## 工程实现清单

- `core/context`：RawHostContext、NormalizedContext、ContextSnapshot、TrustedExecutionContext
  与 VerifiedPrincipal 的 Zod/TypeScript 契约。
- `core/policy`：能力 scope、目标对象和当前页面对象的组合授权策略。
- `core/evidence`：Evidence 持久化记录与不暴露所有权内部字段的安全解析模型。
- `packages/contracts`：HTTP 输入、统一错误、SSE Event、受控 `chart.line` View 和 OpenAPI 描述。
- `apps/agent-server/src/application/`：Mock IdP、Context 服务、Session/Run/Event/Evidence/Audit Store、
  Agent Runner、Event Bridge、API handler 和 Node HTTP adapter。
- `apps/agent-server/src/server-main.ts`：从环境变量解析当前实例模型/插件并启动服务；不向 API
  返回凭证。
- `apps/agent-server/migrations/001_execution_loop.sql`：生产 PostgreSQL 逻辑表、所有权索引、
  Run 幂等/串行约束和保留策略说明。
- A/B Demo Adapter：在模拟原业务 API 边界再次检查已验证主体和对象范围，Evidence 引用绑定
  `executionContextId`。

## Deep Agents 与执行验证

- 继续使用 `deepagents@1.14.2`、`@langchain/langgraph@1.4.10` 和
  `@langchain/langgraph-checkpoint@1.1.5`，未 Fork 或重写 Agent Loop。
- Runner 调用官方 compiled graph `stream(..., {streamMode:'messages', subgraphs:true})`；
  AIMessage Tool Call、ToolMessage、文本和子图 namespace 转成平台事件。
- 同一个 Session 的 `threadId` 只由服务端生成并归属校验；两次 Run 通过同一个官方
  `MemorySaver` Thread 恢复，其他 Session 无法猜 ID 读取。
- 事件信封字段为 `schemaVersion/eventId/sequence/sessionId/runId/timestamp/type/data`。
  已产生并验证 `run.started`、`message.delta`、`tool.started`、`tool.completed`、
  `evidence.added`、`view.created`、`subagent.started/completed`、`run.completed` 和
  `run.cancelled`；实现同时覆盖 `tool.failed`、`run.failed`。
- SSE 先重放保留事件，再订阅后续事件；支持 `Last-Event-ID`/cursor，未知游标返回
  `EVENT_CURSOR_EXPIRED`。断开 SSE 不会取消 Run，显式 cancel 才触发 AbortController。

## 权限、Context、Evidence 与安全验证

- 未认证返回 401；跨用户 Session、Run、Evidence 使用不可见语义返回 404；同 Session 并发
  Run 返回 409；固定窗口限流返回 429；错误响应不含 stack。
- Raw Context 中伪造的 `user/permissions` 被丢弃，服务端 Mock IdP 填入身份和权限；篡改
  `object.rawId` 在 Context 归一化前被拒绝。
- `data_quality.get_trend` 的 `tableId` 必须同时满足 capability scope、授权对象集合与当前
  Context 对象；附加 `internalFields` 被严格 Schema 以 `INVALID_INPUT` 拒绝。
- 绕过统一 Executor 直接调用 Demo Adapter 时，未经授权的对象仍得到 `FORBIDDEN`，证明
  Tool 层与模拟原业务 Adapter 层均有拒绝点。
- Evidence 引用不包含长期业务 URL；解析时重新检查用户、租户和对象范围。View 仅允许受控
  Schema，不执行插件 HTML/React/JavaScript。
- API 只公开模型 provider/model/version/enabled 元数据；密钥仍仅从环境变量进入服务端模型
  构造器，未写入日志、审计、事件或响应。

## 测试执行结果

阶段最终门禁结果将在最终交付前以最后一次命令为准。当前已完成的关键验证：

- `pnpm lint`：Pass，0 errors、0 warnings。
- `pnpm typecheck`：Pass，12 个有脚本的 workspace package 全部完成。
- `pnpm test`：Pass，17 test files、52 tests；全部离线可运行。
- `pnpm build`：Pass，12 个有构建脚本的 workspace package 全部完成。

测试使用 LangChain 官方 `fakeModel()` 驱动真实 Deep Agents 图、Tool、Checkpointer 和
Streaming；HTTP 通过真实 Node TCP 临时端口验证。身份、A/B 上游数据与原业务授权为 Mock，
不冒充真实企业系统。M0 已单独使用配置的 DeepSeek 模型验证真实 Tool Calling；本次 M2
门禁不消耗外部模型额度。

## 架构一致性、偏差与 ADR

- Core 不依赖 Deep Agents、Adapter 或 React；Agent Server 是唯一 Composition Root；
  Agent Runtime 仍是官方 Harness 的薄封装；无 A/B 动态路由、插件市场或多渠道 Gateway。
- 当前 M2 Store 是进程内实现，Checkpointer 是官方 MemorySaver，因此只保证同一服务进程
  的会话恢复，不保证服务重启恢复。SQL 文件是生产 Schema 基线，不等同于已连接 PostgreSQL。
- Context 归一化使用当前 M2 Mock Context Authorizer/标准对象选择，尚未扩展 Plugin SDK 的
  产品 Context Adapter 钩子。
- 上述是明确 Mock/部署集成边界，不改变已接受架构决策，故未新增 ADR。

## 后续阶段准备与剩余问题

- M3 可基于稳定的 Session/Run/Message、SSE、View 与 Evidence 协议实现 Shared Chat Core。
- 在生产或 M5 验收前必须接入企业 IdP、真实产品授权 API、持久化 Repository、官方持久化
  Checkpointer、HTTPS/CORS 部署策略及保留任务，并完成服务重启恢复测试。
- M3 不应把当前 Mock Token 暴露为生产认证方案，也不应直接解析 LangGraph raw chunk。

是否通过 M2 Exit Criteria：**YES（M2 Mock 产品边界）**。已认证模拟用户可查询模拟产品的
质量数据并得到范围、时间和来源；Tool Policy 与 Adapter 都拒绝越权；同一部署进程的会话可
继续；Mock 与真实边界已明确记录。
