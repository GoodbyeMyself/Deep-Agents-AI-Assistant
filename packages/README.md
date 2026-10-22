# packages

`packages/` 存放可复用的平台技术组件。它们为 Agent、MCP 客户端、前端和宿主接入提供 Runtime、
协议与 UI，不定义业务能力或产品 API。

## 当前 Packages

| 目录 | 职责 |
| --- | --- |
| `agent-runtime/` | 官方 Deep Agents 的薄封装、运行策略和诊断去敏 |
| `mcp-client-runtime/` | 外部 MCP 连接、Tool 发现/批准快照和 LangChain Tool 安全适配；不理解业务 Schema 语义 |
| `contracts/` | REST、SSE、Assistant View 等跨端公共协议 |
| `assistant-transport/` | Session/Run/Evidence 客户端和 SSE 断流续传 |
| `assistant-ui/` | 独立 Web 与嵌入模式共享的 React Chat Core |
| `assistant-sdk/` | React 与原生 JavaScript 宿主接入 API |
| `iframe-bridge/` | 跨 Origin 消息、一次性 Ticket 和声明式 Loader 的安全桥 |

## 依赖边界

- Package 应当可复用，不出现 Product A/B/C 的业务分支。
- Agent Runtime 的目标路径只消费经批准的 MCP Tool Snapshot，不硬编码产品 Tool 名或业务字段。
- UI、SDK 和 Transport 只消费受控 API/View 契约，不直接访问业务 API 或密钥。
- V2.2 中，每个系统的 MCP 独立拥有自己的 Tool、Schema、权限和业务 API。主仓不保留
  `domains/*`、`adapters/*`、业务 `skills/*`、业务模板或 Plugin SDK/Runtime。

## 新增 Package

只有代码确实需要被两个以上模块复用、并且拥有清晰公共 API 时才创建新 Package。避免建立空壳
包、按技术名词过度拆分，或用路径别名绕过 `package.json` 的 `exports` 边界。

新增或修改公共 API 时，需要同步检查：

- 依赖方向是否产生循环；
- Node/Browser 运行环境是否明确；
- 类型与运行时导出是否一致；
- 是否影响插件协议、安全边界和向后兼容；
- lint、typecheck、build 与相关回归是否覆盖。

相关文档：[工程结构与依赖规则](../docs/architecture-v2.0/03-工程结构与依赖规则.md)、
[Deep Agents Runtime](../docs/architecture-v2.0/06-DeepAgents运行时设计.md)。
