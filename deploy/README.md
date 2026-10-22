# 平台部署

`deploy/` 只构建和发布 Agent Server、独立 Web 与 iframe Embed，不发现、构建或复制任何业务
Adapter/Plugin。业务能力由部署环境批准并连接的外部 MCP Server 提供。

## 打包

由用户在仓库根目录执行：

```bash
pnpm install
pnpm pack:deploy
```

输出目录 `deploy/out/` 包含：

```text
server/
web/
embed/
release.json
```

`release.json` 的 `businessCapabilitySource` 固定为 `external-mcp`。

## 独立部署

同一平台代码可以分别部署给 Product A、Product B，但每个部署只连接本系统批准的 MCP Server。
不同实例的模型密钥、MCP 凭证引用、Session Repository 和 Checkpointer 必须隔离。平台不根据
Product ID 动态路由业务能力。

`deploy/env/*.example` 只能填写非敏感示例；真实模型 Key 和 MCP 凭证由密钥系统注入。MCP 生产
连接配置和 Streamable HTTP 生命周期仍属于后续阶段，当前不得把开发 stdio 配置当作生产方案。

## 安全边界

- MCP Server/Tool/Schema 摘要/风险必须显式批准；发现不等于可用。
- UI Context、Prompt 和 Tool 参数不能授予权限。
- MCP Server 与原业务 API 必须执行最终对象、行、列权限和脱敏。
- Agent Server 只输出经过平台校验的 Evidence 引用与安全运行状态。
