# Deep Agents AI Assistant

企业业务智能体的**平台仓库**。主仓只负责身份、会话、上下文、模型与 Agent 运行、MCP 客户端治理、
Evidence、HTTP/SSE/AG-UI、Web/Embed Shell；所有业务能力由外部 MCP Server 提供。

## 架构边界

```text
Product A ──> Product A MCP ──┐
                              ├──> MCP Client Runtime ──> Deep Agents ──> Platform API/UI
Product B ──> Product B MCP ──┘
```

- 一个业务系统对应一个独立 MCP 项目和部署单元。
- MCP 自己拥有 Tool、Schema、业务 API 映射、凭证引用和业务权限校验。
- 主仓不提供共享业务 Domain、Adapter、Provider、业务 Skill 或业务模板。
- 主仓不扫描或执行本地业务插件；Agent 只接收平台发现并批准的 MCP Tools。
- UI Context、Prompt 和 Tool 参数都不是授权依据；MCP Server 必须继承原业务系统权限。

## 主仓结构

```text
apps/
  agent-server/          # 平台服务组合根、REST/SSE/AG-UI、Session/Run
  assistant-web/         # 独立 Web Shell
  assistant-embed/       # iframe Shell
packages/
  agent-runtime/         # 官方 Deep Agents 薄封装
  mcp-client-runtime/    # MCP Tool 发现、批准快照和 LangChain Tool 转换
  contracts/             # 平台跨端协议
  assistant-transport/   # 浏览器传输客户端
  assistant-ui/          # Shared Chat Core
  assistant-sdk/         # 宿主 SDK
  iframe-bridge/         # iframe 安全桥
core/
  context/               # 可信 ContextSnapshot
  evidence/              # Evidence 保存、解析和二次鉴权
docs/                    # 架构、ADR、实施状态和验收记录
deploy/                  # 仅打包平台 Server/Web/Embed
tests/                   # 平台与 MCP 客户端测试
```

产品演示已迁移到独立仓库 `E:\Deep-Agents-AI-Assistant-Demo`，不属于主仓 workspace 或发布物。

以下旧业务能力目录和机制已经移除：`adapters/`、`domains/`、业务 `skills/`、`templates/`、
`plugin-sdk`、`plugin-runtime`、Capability 兼容包及其 E0–E5 回归链路。

## MCP 仓库

业务 MCP 在独立仓库 `E:\Deep-Agents-AI-Assistant-MCP` 开发。根目录直接放置各系统项目，例如：

```text
E:\Deep-Agents-AI-Assistant-MCP\
  product-a-mcp/
  product-b-mcp/
```

不同 MCP 之间不共享业务契约；需要复用时只能提取不含业务语义的基础设施库。

## 当前状态

`packages/mcp-client-runtime` 已提供只读 Tool 治理、Schema 摘要批准、调用超时和结果大小限制。
生产级 MCP 连接配置、生命周期、健康状态和密钥引用仍按
[V2.2 架构](docs/architecture-v2.0/22-V2.2-一系统一MCP架构.md) 后续阶段实现。

验证命令必须由用户执行：

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

不要提交模型 Key、长期业务 Token 或敏感业务数据。
