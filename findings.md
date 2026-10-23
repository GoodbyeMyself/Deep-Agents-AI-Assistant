# Docker/PostgreSQL 调研记录

- 本地 Docker Desktop Linux Engine 29.4.1 可访问，Compose v5.1.3；检查时没有运行中容器。首次沙箱访问被拒绝，已按授权提升权限确认。
- 三仓 git status 均干净（本任务写入计划文件前）。
- 主仓 Agent Store 为同步 Map 实现；Service/Runner/HTTP/AG-UI 多处直接调用，需要完整异步适配。
- create-application 固定创建 InMemoryAgentStore、MemorySaver、MockIdentityProvider 和 MockContextAuthorizer。
- Product A 有 HTTP MCP 入口，但 Host 校验只允许 localhost，容器服务名会被拒绝；需显式配置允许的 Host。
- Product B 当前只有 stdio 服务脚本，本轮不扩展。
- 主仓生产 MCP Client 装配尚无 HTTP，stdio 在 production 下禁止。
- deploy/pack.mjs 动态导入 server/dist/application/bootstrap.js，源码实际入口为 composition/create-application.ts，需修正。
- 官方 npm 元数据：checkpoint-postgres 1.0.6 要求 core ^1.1.44、checkpoint ^1.1.4，兼容现有 core 1.2.14、checkpoint 1.1.5；1.1.x 要求 checkpoint ^1.2.0，因此本任务不直接升级至 1.1.x。
- 官方 npm 元数据：pg 与 @types/pg 最新稳定版均为 8.23.1；最终 API 仍以用户安装后的实际类型为准。
- npm 元数据首次请求被沙箱网络阻断，提升权限后读取成功；未安装依赖，未运行任何 pnpm 命令。

## 依赖安装后的实施事实

- 用户安装后的 PostgresSaver 1.0.6 支持 new PostgresSaver(pool, undefined, { schema })、setup/getTuple/put/deleteThread。
- 本地 PostgreSQL 17 已运行，绑定 127.0.0.1:55432；命名卷保留；assistant_test 与应用库隔离。
- 终态和对应事件需同事务，已新增 finishRun。事务内所有读取使用同一连接，避免连接池耗尽造成嵌套等待。
- 真实数据库测试尚未执行，不得将已写入代码报告为通过持久化验收。

## 平台扩展回归失败根因

- 用户输出证明 Agent Server 编译与 MCP 11 项测试通过，平台扩展在两个既有检查中失败。
- 当前 Skill 内容的 LF 目录摘要为 47a750c7e936b4e7801bec996b7955202ec93c45995a347e29e27239e8bfe307，与声明一致；工作区 CRLF 目录摘要为 ebe782b16679ff34bf58cddafacc2463a0af6438065339f81684a719cfab6460。
- .gitattributes 使用迁移前目录，已改为 extensions/*/skills/** text eol=lf，当前文件已物理归一化；Runtime 继续按原始字节校验，不放宽安全语义。

## HTTP MCP 与打包阶段

- 用户已确认上一轮门禁通过，并在主仓 .env 添加模型配置，选择继续使用 DeepSeek。
- 实际锁定的 MCP Client 2.3.1 从主入口导出 StreamableHTTPClientTransport，接受 authProvider.token 与 fetch；未使用旧 SDK import 路径。
- Product A HTTP 原实现只允许 localhost Host，且未配置 expected Bearer 时接受任意 Token；本地 Docker 路径已改为明确 Host allowlist 和短期签名校验，production 非本地演示路径因缺企业认证而拒绝启动。
- 本地 HMAC 是演示信任机制，不是企业 IdP；业务 client 仍为 Mock，不能将该签名 Token 当作真实网关凭证。
- 静态跨域模块需要 CORS，Embed Nginx 已为明确的 Demo Origin 添加响应头，iframe 的票据和消息边界不变。
- Compose 六服务配置已通过 config --quiet，未输出展开配置或任何密钥；其余应用镜像尚未构建。
- 用户需执行 MCP pnpm test:product-a，以及主仓 pnpm typecheck/lint/test/pack:local；Codex 未运行或间接运行 pnpm。
