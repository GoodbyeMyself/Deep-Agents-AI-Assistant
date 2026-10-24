# Assistant API Contracts

`@assistant/contracts` 是 Agent Server、Transport、UI 与 iframe-bridge 共用的**平台传输契约**包：HTTP 写请求体、统一错误、可重放 SSE 事件、受控 ViewModel，以及面向 AG-UI 1.0 的扩展 schema 与确定性投影。

业务 Tool 的输入/输出、权限名称与错误语义**不在此包**；它们由各系统独立 MCP 项目定义。

## 主要内容

| 类别 | 代表导出 | 用途 |
|------|----------|------|
| HTTP | `apiErrorSchema`、`createSessionRequestSchema`、`createRunRequestSchema` | 校验 REST 写请求与标准错误体 |
| SSE | `assistantEventSchema`、`AssistantEvent` | 持久化/重放的 Run 事件信封 |
| UI | `assistantViewSchema`、`hostNavigationActionSchema` | 白名单渲染与宿主导航动作 |
| 治理 | `resumeRunRequestSchema`、`assistantInterruptSchema` | interrupt 公开面与 resume 请求 |
| AG-UI | `projectAssistantEventToAgUi`、`agUiEventSchema` | 官方 AG-UI 校验 + 企业扩展 + 投影 |
| 文档 | `openApiDocument` | M3 API 路径索引（非完整 OpenAPI） |

## 源码布局

对外**仅**通过 `package.json` 的 `"."` → `dist/index.js` 引用；子目录是内部分层，不提供 subpath export。

```text
packages/contracts/src/
│
├── index.ts                          # 聚合 re-export；不在此定义 schema
│
├── http/                             # REST 入参 + API 面索引
│   ├── errors.ts                     # apiErrorSchema（code / message / traceId）
│   ├── sessions-runs.ts              # Session 创建/更新、Run 创建（含幂等 clientRequestId）
│   └── openapi.ts                    # openApiDocument：路径清单，详述由 agent-server 同步
│
├── sse/                              # 平台原生事件流（持久化事实来源）
│   └── assistant-events.ts           # assistantEventTypeSchema、assistantEventSchema
│                                     # data 按 type 解析；eventId + sequence 用于去重/重连
│
├── ui/                               # 客户端可安全渲染的结构化 UI
│   ├── host-actions.ts               # host.navigate：不透明 action key + 参数上限
│   └── views.ts                      # text / metric / table / chart.line / references /
│                                     # action.navigate（discriminatedUnion viewType）
│
├── governance/                       # 人机协同与 Run 恢复（非业务 Tool 契约）
│   └── interrupts.ts                 # resumeRunRequestSchema；
│                                     # enterpriseApprovalInterruptValue（Graph 侧）；
│                                     # assistantInterruptSchema（SSE 公开面，脱敏）
│
└── ag-ui/                            # @ag-ui/core 1.x 与企业扩展
    ├── index.ts                      # 再导出 schemas / cursor / projection
    ├── schemas.ts                    # 官方 Event/RunAgentInput 校验包装；
    │                                 # CUSTOM 事件名、metadata 信封、投影状态类型
    ├── cursor.ts                     # 一条 AssistantEvent → 多条 AG-UI 事件时的游标
    └── projection.ts                 # projectAssistantEventToAgUi（纯函数、可重放）
```

### 模块依赖（仅包内）

```text
index.ts
  ├── http/*
  ├── sse/assistant-events
  ├── ui/views ──► ui/host-actions
  ├── governance/interrupts
  └── ag-ui/
        schemas ──► ui/views
        cursor ──► schemas
        projection ──► sse/assistant-events, governance/interrupts, ui/views, cursor, schemas
```

设计要点：

- **`sse/` 与 `ag-ui/` 分离**：`AssistantEvent` 是存储与 SSE 的 canonical 形态；AG-UI 是读模型投影，避免 `ag-ui` 与根 barrel 循环依赖。
- **`ui/host-actions` 独立于 View**：iframe-bridge、extensions 可直接校验导航动作，而不依赖完整 View 联合类型。
- **`governance/interrupts` 双 schema**：Graph 写入的 `enterpriseApprovalInterruptValue` 与对外事件的 `assistantInterrupt` 字段范围不同，防止 Tool 参数泄漏到客户端。

### 主要消费方

| 包 / 应用 | 典型引用 |
|-----------|----------|
| `apps/agent-server` | HTTP 校验、AG-UI 投影端点、Run 持久化事件 |
| `packages/assistant-transport` | SSE 解析、`assistantEventSchema` |
| `packages/assistant-ui` | View 渲染、AG-UI 事件、Host 导航 |
| `packages/iframe-bridge` | `hostNavigationActionSchema` |
| `extensions/host-navigation` | 动作键 allowlist 对齐 |

### 变更纪律

- 新增 `assistantEventType` 或 View `viewType`：保持 `schemaVersion: "1"` 兼容策略，并同步 agent-server、UI store 与契约测试。
- 调整 AG-UI 投影：必须保持对同一 `AssistantEvent` 序列的**确定性**；游标格式变更需兼容 `decodeAgUiEventCursor`。
- 不在此包增加业务 Capability ID、MCP Tool schema 或产品专用字段。

## 边界

此包描述平台传输协议，不承载业务 Tool 语义；业务契约位于各系统自己的外部 MCP。任何事件或
View 变更都应保持版本兼容并同步更新前后端测试。

## 验证

```bash
pnpm --filter @assistant/contracts build
pnpm --filter @assistant/contracts typecheck
pnpm --filter @assistant/contracts test
```
