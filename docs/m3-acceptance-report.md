# M3 开发与验收报告

- 日期：2026-10-14
- 基线：V2.0，M2 Exit Criteria 已通过
- 范围：M3-T01～M3-T05；未进入 M4

## 任务完成情况

| 任务                         | 状态                  | 完成证据                                                                                       |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| M3-T01 Assistant Transport   | 完成                  | 版本化 REST/SSE、Bearer、事件校验/去重、断流后 Run 状态查询与有限续传                          |
| M3-T02 Shared Chat Core      | 完成                  | 会话列表/切换、新建、历史恢复、提交、增量回答、取消、公开执行进度与异常状态                    |
| M3-T03 可信 View 与 Evidence | 完成                  | text/metric/table/chart.line/references 白名单 Renderer，Evidence 二次鉴权抽屉，未知 View 拒绝 |
| M3-T04 独立 Web Shell        | 完成                  | 业务对象语义、用户会话管理、模型/能力状态、管理员插件状态、响应式布局                          |
| M3-T05 浏览器验收            | 完成（Mock 产品边界） | Playwright 对真实 Node HTTP + Vite 页面执行查询、SSE、图表、证据、角色隔离和窄屏验证           |

## 工程实现清单

- `packages/assistant-transport/src/index.ts`：产品无关的 Agent Server 客户端；浏览器凭证由调用方
  提供，不落盘；Fetch SSE 支持鉴权头、cursor、Zod 事件校验、去重与断流恢复。
- `packages/assistant-ui/src/`：`ChatWorkspace`、`MessageList`、`ChatComposer`、
  `ExecutionTimeline`、`EvidencePanel`、`AssistantViewRenderer`、安全纯文本/代码渲染和 reducer。
- `packages/assistant-ui/src/styles.css`：共享聊天视觉与响应式样式。
- `apps/assistant-web/src/`：独立 Web Shell、Mock 身份切换、业务对象语义、会话管理和运行状态页。
- `apps/assistant-web/tests/`：本地服务生命周期和 Playwright 端到端验收。
- `apps/agent-server/src/m3-demo-server-main.ts`：只用于离线浏览器验收的官方 LangChain
  `fakeModel()` 启动入口，不替代真实模型验证。
- `packages/contracts/src/index.ts`：Assistant View V1 扩展为 text、metric、table、chart.line、
  references 的封闭判别联合。
- `apps/agent-server/src/m2/node-http.ts`：修复 Web `ReadableStream` 到 Node Response 的逐块转发，
  SSE 不再等待完整响应缓冲。
- `docs/m3-preview.png`：端到端运行后的桌面页面快照。

## 技术验证结果

- 实际版本：React 19.3.0、React DOM 19.3.0、Ant Design 6.6.6、Ant Design X 2.9.0、
  Vite 8.3.4、Playwright 1.64.0。
- Ant Design X 接口已从安装包类型核对并实际编译：`Bubble.List`、`Sender`、`Conversations`、
  `ThoughtChain`、`Sources`、`XProvider`。
- UI 只消费 M2 标准事件，不解析 Deep Agents/LangGraph 原始 chunk。Tool 与 Subagent 只展示公开
  名称、状态和 namespace，不展示模型私有推理。
- `AssistantViewRenderer` 在渲染前使用 Zod 判别联合校验；未知类型显示安全告警；正文不使用
  `dangerouslySetInnerHTML`，脚本/HTML 按文本显示。
- SSE 使用 Fetch 而非原生 EventSource，以携带 Authorization；断流后先查询 Run，终态直接停止，
  非终态使用最后 event ID 有限续传。客户端和 reducer 双重按 event ID 去重。
- 独立 Web 使用 M2 Agent Server API 完成模拟订单质量查询，显示 96% 回答、趋势图、公开执行状态
  和再次鉴权后的 Evidence scope/methodology。

## 权限、Context、Evidence 与安全验证

- Mock Bearer 只用于本地演示；身份切换明确标注“本地模拟身份”，不伪装为生产 SSO。
- 独立 Web 创建 standalone ContextSnapshot，业务对象使用服务端允许的 `rawId`；用户/权限不从 UI
  注入。用户 A 只能选择 orders，用户 B 只能选择 customers，Mock 管理员才含 `platform:admin`。
- `/plugins` 仍由服务端强制管理员 scope；普通用户页面不请求/不显示插件明细。
- Evidence 点击后通过 `/evidence/{referenceId}` 再次鉴权；不可用、越权和缺失证据统一显示安全错误，
  不泄露对象是否存在。
- 会话切换重置本地 reducer 并从服务端读取当前身份会话，避免跨 Session 消息混合。

## 测试与命令

最终门禁结果：

- `pnpm lint`：Pass，0 errors、0 warnings。
- `pnpm typecheck`：Pass，15 个 workspace 项目纳入递归构建/类型检查。
- `pnpm test`：Pass，最终共 22 test files、63 tests。
- `pnpm build`：Pass，15 个 workspace 项目完成；Web 有已记录的主包体积警告。
- `pnpm e2e`：Pass，3 个 Chromium 用例（可信查询、管理员隔离、窄屏主路径）。

单元/集成测试均为离线 Mock 模型，但运行真实 Deep Agents 图、Tool、HTTP、SSE 和 React reducer；
Playwright 使用真实 Chromium。M0 的 DeepSeek Tool Calling 真实模型烟测没有在 M3 重复消耗额度。

## 架构一致性、偏差与 ADR

- 新增 ADR-017：浏览器只消费版本化 REST/SSE 和受控 Assistant View；不暴露 LangGraph raw
  chunk，不允许运行插件提供的 HTML/React/JavaScript。
- Chat Core 位于共享 `assistant-ui`，独立 Web 只负责 Shell 和页面级状态；未实现 M4 的 React SDK、
  JavaScript SDK 或 iframe Bridge。
- 当前 Vite 生产构建主包仍有大于 500 kB 的非阻断警告，主要来自 Ant Design/Ant Design X；M4
  在 SDK 拆分时应做按 Shell/管理页的动态分块和包体预算。
- M2 的内存 Store、MemorySaver、Mock IdP 与模拟业务 Adapter 边界保持不变；页面成功不代表真实
  企业权限、业务 API 或持久化已接入。

## 后续准备与剩余问题

- 当前 API、Transport、共享 UI 和独立 Shell 已为 M4 的嵌入式 React/JS/iframe 适配提供稳定边界。
- M4 前需决定 SDK 发布的 CSS 隔离、宿主 token 注入和 iframe origin allowlist；这些未在 M3 提前实现。
- 生产前仍需企业 IdP、真实产品 Context Adapter/业务 API、持久化 Repository/Checkpointer、HTTPS
  和安全响应头部署验证。

是否通过 M3 Exit Criteria：**YES（M2 Mock 产品边界）**。独立 Web 已通过真实浏览器调用 Agent
Server 完成质量查询并显示可追溯结果；Shared Chat Core 与产品 A/B 字段无关；权限、Context、
Evidence 边界保持在服务端。
