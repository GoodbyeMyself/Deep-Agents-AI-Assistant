# M0 开发与验收报告

- 日期：2026-10-14
- 基线提交：`7b98c53`（工作区含用户提供的未提交 V2.0 文档变更）
- 范围：M0-T01～M0-T05；未进入 M1

## 任务完成情况

| 任务                     | 状态                             | 完成证据                                                               |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| M0-T01 环境与依赖审计    | 完成                             | Git/Node/pnpm/OS 审计；官方源码、导出、类型、测试范式核验；锁文件生成  |
| M0-T02 工程初始化        | 完成                             | workspace、strict TS、ESLint、Prettier、Vitest、CI、env 样例、统一脚本 |
| M0-T03 原生 Agent + Tool | 完成（Mock + DeepSeek 真实模型） | Tool 实际执行并读取 Runtime Context，结果回到 Agent，最终模型响应完成  |
| M0-T04 运行扩展          | 完成（Mock 模型）                | Skill、Subagent 最小权限、Backend、MemorySaver Thread 恢复与两类流验证 |
| M0-T05 兼容性与报告      | 完成                             | 兼容性记录、去敏 fixture、实施状态、安全日志测试与本报告               |

## 工程实现清单

- 根配置：`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、
  `tsconfig.base.json`、`eslint.config.js`、`.prettierrc.json`、`.env.example`、
  `.github/workflows/ci.yml`。
- `core/capability`：质量趋势输入、输出、Evidence 最小 Zod 契约及契约测试。
- `packages/agent-runtime`：可信 Run Context、产品无关 Tool Factory、Deep Agents 薄装配、
  诊断脱敏、运行/流式集成测试。
- `apps/agent-server`：`ChatOpenAI` 真实模型烟测入口；缺 Key 时明确失败，不静默 Mock。
- `skills/poc-data-quality/SKILL.md`：实际由 FilesystemBackend 加载的领域技能。
- `tests/fixtures/deepagents-stream-events.v1.json`：去敏后的 raw/v3 流事件结构。
- `docs/deepagents-compatibility.md`、`docs/implementation-status.md`：技术记录。

## Deep Agents 技术验证

使用 `deepagents@1.14.2`、`langchain@1.5.10`、
`@langchain/core@1.2.14`、`@langchain/langgraph@1.4.10`。已验证
`createDeepAgent`、LangChain `tool`、`contextSchema`/invoke `context`、声明式
Subagent、`FilesystemBackend`/`skills`、`MemorySaver`/`thread_id`、原生
`stream()` 与 `streamEvents(version: 'v3')`。

Tool Calling 使用官方测试模型生成可重复的真实 tool call；自研 Executor 的调用次数、
输入、Runtime Context、返回 Evidence、ToolMessage 和最终回答均有断言。此外，已使用
`deepseek-flash` 通过配置的 OpenAI-compatible endpoint 完成真实在线闭环：模型调用
`data_quality_get_trend`，收到包含 Evidence 的 ToolMessage，并基于结果生成最终回答。
模型识别到七天查询只返回一个数据点，没有将单点描述为已验证趋势。

## 测试记录

最终门禁结果：

- `pnpm lint`：Pass，0 errors、0 warnings。受限沙箱内首次执行因读取 pnpm 依赖文件
  `EPERM` 未进入 lint；在获批的外层权限下以原命令重跑通过。
- `pnpm typecheck`：Pass，3 个 workspace package 全部完成。
- `pnpm test`：Pass，4 个 test files、11 个 tests。
- `pnpm build`：Pass，`capability-contracts`、`agent-runtime`、`agent-server` 全部构建。
- 流 fixture 捕获命令：指定运行 `streaming.integration.test.ts`，3/3 Pass。
- `pnpm --filter @assistant/agent-server smoke:deepseek`：Pass；真实 DeepSeek 模型完成
  Agent → Tool → ToolMessage → 最终回答。首次使用 endpoint 不支持的模型标识时返回
  HTTP 400，改为接口支持的 `deepseek-flash` 后通过。

测试边界：自动化测试中的模型响应为 Mock；额外烟测使用真实 DeepSeek 模型。Harness、
图执行、Tool、Backend、Subagent、Checkpoint、Context 和 Streaming 均为真实安装包执行。
烟测 Tool 返回合成数据，因此只证明真实模型调用链，不宣称真实企业业务集成完成。

## 架构一致性与安全检查

- 依赖方向为 `core/capability -> agent-runtime -> agent-server` 的反向使用关系：Core
  不依赖 Deep Agents，runtime 不依赖任何 A/B/C Adapter，server 是 composition root。
- 未实现或复制 Agent Loop、LangGraph 状态机、Plugin Loader、Registry、管理后台或 SSE。
- Tool Schema 不含 user/tenant/credential；可信上下文通过 server config 传引用。
- Subagent 仅获显式只读 Tool；动态工具可见性未被当作最终授权机制。
- `.env` 被忽略，`.env.example` 无密钥；诊断对象递归脱敏有自动测试。
- 质量趋势最小结果携带 Evidence 引用；完整 Policy/Evidence 执行器属于 M1/M2。

与基线的必要实现差异：为绕过官方发布声明文件自身的类型不兼容，启用
`skipLibCheck: true`；自有源码仍为 strict。`getState()` 使用一次窄 unknown 断言。
这些是 SDK 兼容性处理，不改变架构决策，不新增 ADR。

## 剩余问题与进入 M1 条件

- DeepSeek 真实模型 E2E 已验证；该供应商 endpoint 的模型标识与产品展示名不同，部署时
  必须使用其 API 接受的 `deepseek-flash`。离线 CI 仍不依赖模型 Key。
- MemorySaver 仅证明进程内 Thread 恢复；持久化 Checkpointer 与重启恢复按 M2 验证。
- raw streaming 节点名和 namespace 是框架内部结构；M2 必须通过 Event Bridge 归一化。
- M1 可基于已验证的 Tool Factory/Context 边界开始 Plugin SDK、可信 Loader、Registry 与
  双 Adapter POC；当前未提前实现这些能力。

是否通过 M0 Exit Criteria：**YES**。依赖安装可重现，lint/typecheck/test/build 通过，
Tool/Skills/Subagent/Context/Checkpoint/Streaming 均有真实框架运行证据；DeepSeek 真实
供应商模型调用也已通过。完整企业权限与真实业务 Adapter 仍按后续阶段实施。
