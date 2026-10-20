# packages

`packages/` 存放可复用的平台技术组件。它们为 Agent、插件、前端和宿主接入提供 SDK、Runtime、
协议与 UI，但不定义具体产品 API，也不承载数据地图、数据质量等标准业务语义。

## 当前 Packages

| 目录 | 职责 |
| --- | --- |
| `agent-runtime/` | 官方 Deep Agents 的薄封装、Tool Factory、Skill Snapshot 和诊断去敏 |
| `plugin-sdk/` | `definePlugin()`、`implementCapability()` 等插件开发 API |
| `plugin-runtime/` | Manifest、可信发现、批准/哈希校验、事务注册、Skill 和生命周期 |
| `contracts/` | REST、SSE、Assistant View 等跨端公共协议 |
| `assistant-transport/` | Session/Run/Evidence 客户端和 SSE 断流续传 |
| `assistant-ui/` | 独立 Web 与嵌入模式共享的 React Chat Core |
| `assistant-sdk/` | React 与原生 JavaScript 宿主接入 API |
| `iframe-bridge/` | 跨 Origin 消息、一次性 Ticket 和声明式 Loader 的安全桥 |
| `capability-contracts/` | 旧聚合导出的临时兼容层；新代码应直接依赖 Core 或 `domains/*` |

## 依赖边界

- Package 应当可复用，不出现 Product A/B/C 的业务分支。
- Agent Runtime 只消费已注册的 Catalog、Registry、Tool 和 Skill，不硬编码具体 Capability ID。
- Plugin Runtime 只装载批准的构建产物，不提供市场、任意上传或热加载。
- UI、SDK 和 Transport 只消费受控 API/View 契约，不直接访问业务 API 或密钥。
- 具体业务 Contract 放在 `domains/*`，产品 Provider 放在 `adapters/*`，通用安全不变量放在
  `core/*`。

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
