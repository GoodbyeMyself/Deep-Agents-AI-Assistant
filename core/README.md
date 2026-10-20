# core

`core/` 是与具体业务领域、产品和 Agent 框架无关的稳定内核。它定义企业助手必须统一执行的
Capability、Context、Policy 和 Evidence 规则，不枚举数据地图、数据质量等具体业务能力。

## 当前模块

| 目录 | 职责 |
| --- | --- |
| `capability/` | 通用 Contract、Catalog、Registry、Executor、Result Schema 和 Audit 接口 |
| `context/` | Host Context 白名单、Normalized Context 与 ContextSnapshot |
| `policy/` | 服务端授权策略和可信主体边界 |
| `evidence/` | Evidence 保存、解析、当前主体二次鉴权与安全返回 |

## 依赖边界

Core 必须保持业务和框架中立：

- 不依赖 `deepagents`、LangChain Agent、React、具体 Adapter 或应用入口；
- 不包含 `data_map.*`、`data_quality.*` 等具体业务 ID；
- 不读取产品环境变量，也不处理 Product A/B/C 分流；
- 可以提供稳定类型、Schema、接口和纯执行规则，供上层组合。

依赖方向是 `core → domains/plugin-sdk/runtime → apps`。如果一段代码只有某个业务领域理解，应放到
`domains/`；如果是产品 API 映射，应放到 `adapters/`；如果是可复用技术组件，应放到 `packages/`。

## 安全不变量

- 身份和权限由服务端可信上下文建立，Tool 参数不能自报用户或权限。
- Capability Executor 按输入校验、权限、Provider、输出 Schema、Audit 的顺序执行。
- ContextSnapshot 在一次 Run 内固定。
- Evidence 展示时按当前主体再次鉴权。
- 未安装 Provider 的已知能力返回 `UNSUPPORTED`，不伪装为空结果或临时故障。

相关文档：[核心领域契约](../docs/architecture-v2.0/04-核心领域契约与上下文.md)、
[安全与审计](../docs/architecture-v2.0/08-安全权限证据与审计.md)。
