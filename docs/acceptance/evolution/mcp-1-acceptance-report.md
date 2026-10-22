# MCP-1 外部业务 MCP 最小只读切片验收报告

> 日期：2026-10-21  
> 状态：实现完成 / 用户门禁待执行

## 范围

只验证 Product A MCP 自己声明的 `get_quality_trend` 只读 Tool：业务 Schema、Mock Product A 逻辑和
业务结果全部在根级 `product-a-mcp/`；主仓只实现通用 MCP 发现、批准快照与 LangChain Tool 适配。
不切换默认 Agent Server，不实现生产 HTTP、真实用户委托或 Evidence 解引用。

## 已实现

### MCP 仓

- `@business-mcp/product-a`：Product A 自有输入、输出、错误、Evidence、MCP Server 和 stdio。
- 不存在共享 Domain 包、跨产品 Capability 元数据或产品 Adapter 层。
- in-memory 协议测试覆盖发现、结构化输出、额外身份字段、非法时间范围、业务拒绝、超时和取消。

### 主仓

- `@assistant/mcp-client-runtime`：stdio 开发连接、候选 Tool 发现、规范化 Schema SHA-256、只读治理、
  显式批准快照、调用超时、结果大小限制和 LangChain Tool Factory。
- 平台运行时不导入任何数据质量契约，不解析业务结果语义。
- 单测覆盖稳定摘要、批准漂移、未批准/非只读 Tool、结构化内容、取消信号转发和错误去敏。
- 跨仓 stdio 测试只验证平台可发现、批准并调用 Product A MCP，不再与旧 Adapter 做语义对比。

## 安全边界

- MCP Tool 参数严格拒绝 `userId` 等额外字段；身份不由模型参数建立。
- `tools/list` 只产生候选；批准同时绑定 Server ID、Tool 名、只读风险和输入/输出 Schema 摘要。
- 未批准 Tool 不暴露，远端写/高风险 Tool 在 MCP-1 直接拒绝。
- `isError` 内容不原样抛给模型；只消费经 SDK outputSchema 验证的 `structuredContent`。
- LangChain Run 的取消信号传入 MCP SDK 请求选项；MCP in-memory 测试验证信号抵达 Tool Handler。
- stdio 仅限开发，命令与 cwd 必须为绝对路径且不经 shell。

## 待用户执行

先在 MCP 仓：

```powershell
cd E:\Deep-Agents-AI-Assistant-MCP
pnpm install
pnpm test:mcp-1
pnpm typecheck
pnpm build
```

再在主仓：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm install
pnpm test:mcp-1
$env:MCP_SERVER_ENTRY='E:\Deep-Agents-AI-Assistant-MCP\product-a-mcp\dist\stdio.js'
$env:MCP_SERVER_ID='product-a-mcp'
$env:MCP_TEST_TOOL_ARGUMENTS='{"tableId":"orders","startTime":"2026-10-07T00:00:00+08:00","endTime":"2026-10-14T00:00:00+08:00"}'
pnpm test:mcp-1:stdio
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

`pnpm install` 需要生成 MCP 仓 lockfile，并更新主仓 lockfile 的 MCP Client importer。用户提供真实输出前，
上述命令均记录为“未执行/待用户验证”。

## 退出门禁

- [x] 平台/业务仓边界在源码中保持：主仓无业务契约依赖。
- [x] 一个只读 Tool 的 Server、Client、发现、批准和 Tool Factory 已实现。
- [x] Product A 独立 Mock、Schema、安全、超时和取消测试已编写。
- [ ] 两仓依赖已由用户安装并锁定。
- [ ] MCP in-memory、主仓单测和跨仓 stdio 测试真实通过。
- [ ] 两仓 typecheck/build 及主仓全量门禁通过。

因此 MCP-1 当前尚未通过退出门禁。
