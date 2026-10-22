# core

`core/` 是与具体业务领域、产品和 Agent 框架无关的稳定平台内核，仅保留 Context 与 Evidence
等平台安全规则。业务 Tool 的输入输出及业务权限由各自 MCP Server 定义并强制执行。

## 当前模块

| 目录 | 职责 |
| --- | --- |
| `context/` | Host Context 白名单、Normalized Context 与 ContextSnapshot |
| `evidence/` | Evidence 保存、解析、当前主体二次鉴权与安全返回 |

## 依赖边界

Core 必须保持业务和框架中立：

- 不依赖 `deepagents`、LangChain Agent、React、具体 Adapter 或应用入口；
- 不包含 `data_map.*`、`data_quality.*` 等具体业务 ID；
- 不读取产品环境变量，也不处理 Product A/B/C 分流；
- 可以提供稳定的平台类型、Schema 和纯规则，供上层组合；不得建立通用业务 Capability 抽象层。

## 安全不变量

- 身份和权限由服务端可信上下文建立，Tool 参数不能自报用户或权限。
- MCP Tool 只能在平台批准后暴露；业务系统必须在 MCP Server 内再次鉴权。
- ContextSnapshot 在一次 Run 内固定。
- Evidence 展示时按当前主体再次鉴权。

相关文档：[核心领域契约](../docs/architecture-v2.0/04-核心领域契约与上下文.md)、
[安全与审计](../docs/architecture-v2.0/08-安全权限证据与审计.md)。
