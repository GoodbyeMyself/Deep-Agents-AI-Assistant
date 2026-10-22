# Deep Agents M0 兼容性记录

日期：2026-10-14  
环境：Windows NT 10.0.19044、Node.js 22.17.0、pnpm 10.32.1

## 锁定版本

| 包                                |   版本 | 说明                                                        |
| --------------------------------- | -----: | ----------------------------------------------------------- |
| `deepagents`                      | 1.14.2 | 官方 TypeScript Agent Harness                               |
| `langchain`                       | 1.5.10 | `tool()`、测试模型及 Agent 流类型                           |
| `@langchain/core`                 | 1.2.14 | Messages、模型基类与官方 `fakeModel()`                      |
| `@langchain/langgraph`            | 1.4.10 | `MemorySaver` 与图执行配置                                  |
| `@langchain/langgraph-checkpoint` |  1.1.5 | Checkpointer 公共类型                                       |
| `@langchain/openai`               |  1.6.2 | 通过 OpenAI-compatible 接口完成 DeepSeek 真实模型烟测       |
| `langsmith`                       |  0.9.0 | workspace override，满足 Deep Agents 的 `<0.10.0` peer 范围 |
| `zod`                             |  4.3.6 | workspace override，与 Deep Agents 源码依赖一致             |

版本由 `pnpm-lock.yaml` 固化。workspace override 避免 peer 自动解析出第二套
`langsmith@0.10.x` 或 Zod，从而降低运行时类身份和追踪实现不一致风险。

## 已验证公开 API

实际安装包类型、官方仓库源码与运行测试共同验证了以下接口：

- `createDeepAgent({ model, tools, systemPrompt, contextSchema, checkpointer, backend, skills, subagents })`。
- LangChain `tool(handler, { name, description, schema })`，handler 第二参数的
  `ToolRuntime.context` 能收到 invoke/stream config 的 `context`。
- `agent.invoke(input, { context, configurable: { thread_id } })`。
- `createDeepAgent({ middleware })` 会按中间件名称合并自定义项；`deepagents@1.14.2` 内置
  `SummarizationMiddleware`，项目使用 `langchain@1.5.10` 的同名公开实现显式配置 token 阈值。
- `langchain@1.5.10` 的 `toolCallLimitMiddleware`、`modelCallLimitMiddleware` 已用于每 Run 调用预算，
  超限选择 `exitBehavior: 'error'`，由平台 Runner 映射稳定错误码。
- `FilesystemBackend({ rootDir, virtualMode: true })` 与 `skills: ['/skills/']`。
- `MemorySaver`：同 `thread_id` 恢复消息历史，不同 Thread 隔离。
- 声明式 Subagent：`{ name, description, systemPrompt, model, tools }`；自定义
  Subagent 不会自动继承主 Agent 的业务 Tool，测试只授予一个只读 Tool。
- 原生流：`streamMode: 'updates' | 'messages'` 配合 `subgraphs: true`。
- 新流接口：`streamEvents(input, { version: 'v3' })` 的 `messages`、`toolCalls`、
  `subagents` AsyncIterable 与 `output` Promise。

去敏后的实际事件结构保存在
`tests/fixtures/deepagents-stream-events.v1.json`，自动化断言在
`packages/agent-runtime/src/streaming.integration.test.ts`。

## 验证结果

| 能力            | 状态                                               | 证据                                                                                                  |
| --------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Agent 创建      | 已验证（Mock 模型）                                | `createAgentRuntime()` 返回并执行官方编译图                                                           |
| Tool Calling    | 已验证（Mock + DeepSeek 真实模型，真实 Tool 执行） | Executor 被调用，ToolMessage 含 Evidence 引用，最终回答由模型基于工具结果生成                         |
| Runtime Context | 已验证                                             | `executionContextId/contextSnapshotId` 从 server config 到达 ToolRuntime；未进入模型 Tool Schema      |
| Skills          | 已验证                                             | `FilesystemBackend` 从真实 `skills/poc-data-quality/SKILL.md` 加载 metadata                           |
| Subagent        | 已验证                                             | `task` 委派成功；子 Agent 只获显式只读 Tool，主业务 Tool 未被调用                                     |
| Backend         | 已验证                                             | `FilesystemBackend` 以 virtual mode 映射仓库根路径                                                    |
| Checkpointer    | 已验证（内存）                                     | `MemorySaver` 同 Thread 恢复、不同 Thread 隔离；进程重启持久化留待 M2                                 |
| Streaming       | 已验证（Mock 模型）                                | text/tool result/subagent namespace/end output 与 raw updates 均有运行断言                            |
| 异常            | 已验证                                             | Tool 抛错会 reject 当前 run；默认不会自动变为 `ToolMessage(status=error)`                             |
| 真实模型调用    | 已验证                                             | `deepseek-flash` 通过配置的 OpenAI-compatible endpoint 完成 Agent → Tool → ToolMessage → 最终回答闭环 |

这里的 “Mock 模型” 仅指模型响应来自 `@langchain/core/testing` 的官方
`fakeModel()`；Deep Agents、LangGraph、Tool、Backend、Subagent、Checkpointer 和
Streaming 均执行真实安装包代码。

真实模型烟测使用合成的 `orders` 质量数据，不包含业务敏感信息。程序仅从被 Git 忽略的
`.env` 读取凭证，输出中不记录 Key。验证命令为
`pnpm --filter @assistant/agent-server smoke:deepseek`。首次使用供应商不支持的模型标识
`DeepSeek-V4.1-Flash` 时接口返回 HTTP 400；按该 endpoint 返回的可用标识改为
`deepseek-flash` 后通过。模型确实调用 `data_quality_get_trend`，并正确指出七天范围只返回
一个日数据点，未把单点数据描述为已验证趋势。

## 已知兼容性事项

1. `deepagents@1.14.2` 的发布声明文件在 `skipLibCheck: false` 时引用当前
   `zod@4.3.6` 未导出的 `ZodPreprocess` 类型；同时 LangChain 若配合
   `exactOptionalPropertyTypes` 检查依赖声明，会产生第三方 `.d.ts` 错误。因此工程
   保持应用源码 `strict`/`exactOptionalPropertyTypes`，但设置 `skipLibCheck: true`。
   自有源码和测试仍完整类型检查。
2. 当前泛型组合下 TypeScript 将 `agent.getState()` 的返回声明推断为 `never`，运行时
   返回标准 StateSnapshot。隔离测试使用一次窄 `unknown -> { values: unknown }` 断言，
   未使用 `any`，并以真实状态内容验证行为。
3. Tool handler 未捕获的异常会使 `invoke()`/`streamEvents().output` reject。M2 Event
   Bridge 必须把它映射为版本化 `tool.failed`/`run.failed`，不能假定 SDK 自动给出平台
   SSE 错误信封。
4. `streamMode: 'messages'` 的子图 namespace 是动态多段数组，如
   `['tools:<subagent-run-id>', 'model_request:<run-id>']`；客户端不能硬编码 UUID 或层数。
5. Deep Agents 默认摘要参数依赖模型 Profile 自动推断。当前 DeepSeek/OpenAI-compatible 配置不依赖
   该推断，项目通过统一 Runtime Policy 明确提供 token/message 阈值；修改阈值必须通过长会话回归。
6. `langchain@1.5.10` 的 Summarization/ToolCallLimit/ModelCallLimit 配置类型经过包内 Zod v3/v4
   interop 推导后，在本仓库 Zod 4 override 与 `exactOptionalPropertyTypes` 下会错误收窄为
   `never`/`undefined`。Runtime Policy 只在第三方导入边界使用 `unknown` 后按锁定源码公开参数做窄
   函数签名适配；没有使用 `any`，没有修改依赖源码，运行时仍调用官方 Middleware。升级依赖时应
   优先删除该适配并恢复直接类型推断。

## M1 对接要求

- M1 的 Tool Factory 只能通过公开 `tool()` 与 Capability Executor 装配，不改变
  Deep Agents Agent Loop。
- 用户、租户、凭证不得进入 Tool 输入 Schema；继续从服务端 Runtime Context 引用解析。
- Plugin Loader 不得依赖 raw streaming 内部节点名。Streaming 到 SSE 的稳定映射属于
  M2 Event Bridge 责任。
- M1 每个 Subagent/Agent 必须显式选择最小 Tool 集合，并保留调用端再次授权。
