# 平台部署

## 本地六服务 Docker（2026-10-24）

本地组合包含 PostgreSQL、Agent Server、独立 Web、Embed、Product A MCP 和 Product A Demo。
当前身份与业务 API 为 Mock；数据库、模型请求与容器网络按实际结果验收，不能据此宣称生产接入。

所有 pnpm 必须由用户执行。三个仓库默认同级，可用 MCP_REPO_PATH、DEMO_REPO_PATH 覆盖构建仓库位置；
跨仓只由本地打包编排器调用独立构建，不引入业务包依赖。

1. 用户在 MCP 仓运行 `pnpm test:product-a`。
2. 用户在主仓运行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 与 `pnpm pack:local`。
   最后一条分别构建三仓并复制产物到 deploy/out，不读取密钥。Codex 不得间接调用该脚本。
3. 运行 `./deploy/initialize-local.ps1`，保留已有数据库密码并补充随机委托密钥。
   模型配置放在主仓 .env；Compose 先加载 deploy/.env.local，再加载主仓 .env。
4. 运行 `./deploy/local-compose.ps1 start`，仅执行 Docker 构建/启动，缺少产物明确失败，不自动 pnpm。

| 服务 | 本地地址 | 说明 |
| --- | --- | --- |
| Product A Demo | http://127.0.0.1:5411 | iframe 和导航验收入口 |
| 独立 Web | http://127.0.0.1:8080 | 同一后端的独立入口 |
| Embed | http://127.0.0.1:5511 | iframe 与 Loader |
| Agent Server | http://127.0.0.1:3411 | 调试 API，仅绑定回环 |
| PostgreSQL | 127.0.0.1:55432 | assistant 应用库、assistant_test 专项库 |
| Product A MCP | 容器内 product-a-mcp:3101 | 不发布本机端口 |

现有 Demo Loader 使用固定 5511 地址，本地方案保留端口；使用 127.0.0.1，保持 iframe Origin、票据与
CSP 一致。生产域名需要另配 TLS，不能直接复用本地 HTTP 例外。

`./deploy/local-compose.ps1 status` 查看状态；`stop` 停止本组合且保留卷；`logs` 查看后端日志。
不执行 down -v。数据卷默认名 assistant-local_postgres-data；不要变更已有卷的数据库密码。

运行 `node deploy/backup-local.mjs` 可用 pg_dump 导出应用库，包括平台及官方 Checkpoint schema。
备份位于忽略的 deploy/backups，按敏感数据保管；恢复应在明确维护窗口内执行，勿覆盖运行中的库。

批准文件 deploy/out/local-mcp-approval.json 使用固定 Server/Tool/Schema/risk，漂移会拒绝启动。
本地签名凭证只用于 Mock 演示，不能作为真实业务网关凭证。企业 IdP、业务 Evidence 再鉴权和生产 TLS 待接入。

源码变更后由用户重新打包，再构建 Docker。验收应确认模型 Tool 调用、消息/事件/审计/Checkpoint 入库，
以及重建 Agent Server 后相同 Session 可继续对话；脚本实现不代表这些验收已经通过。

以下为平台三服务单独打包说明。

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
