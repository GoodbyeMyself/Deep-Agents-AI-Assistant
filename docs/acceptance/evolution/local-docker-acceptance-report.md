# 本地 Docker 与 PostgreSQL 持久化验收

日期：2026-10-24（Asia/Shanghai）

状态：本地部署与运行验收通过。业务身份、业务 API 数据和业务 Evidence 来源仍为 Mock。

## 部署服务

| 服务 | 结果 | 访问地址 |
| --- | --- | --- |
| Product A Demo | Running，首页与 API 200 | http://127.0.0.1:5411 |
| 独立 Web | Running，首页与 API 200 | http://127.0.0.1:8080 |
| Embed | Running，首页、Loader CORS 与 API 200 | http://127.0.0.1:5511 |
| Agent Server | Healthy | http://127.0.0.1:3411 |
| Product A MCP | Healthy | 容器内 product-a-mcp:3101，不发布本机端口 |
| PostgreSQL | Healthy | 127.0.0.1:55432 |

## 构建与启动证据

- 用户确认 pnpm typecheck、pnpm lint、pnpm test、pnpm pack:local 完成。Codex 未运行任何 pnpm。
- 五个应用镜像完成，Compose up --wait 成功；数据库复用 assistant-local_postgres-data 命名卷。
- 首次失败原因是 Windows pnpm 绝对 junction；Docker 构建中的 normalizer 仅转换镜像内依赖链接和
  与 package.json.name 对应的自引用，其他包外路径拒绝。MCP 9 个、Server 284 个链接验证通过。
- 后端日志确认 PostgreSQL/官方 Checkpointer、已批准 MCP Tool 与 host-navigation 初始化成功。
- 新增部署 helper 与 ESLint globals 的最终修改未要求 Codex 绕过 pnpm 复跑标准门禁；以上标准门禁是用户
  确认的构建版本。helper 本身已由 Docker 实际执行并验证全部链接，普通脚本完成语法/差异检查。

## 真实运行验收

1. node deploy/verify-local.mjs before：三个前端首页 200、Loader 只允许 Demo Origin、MCP 状态 ready；
   创建会话与 Context，用实际 DeepSeek 保存随机口令；另一个用户读取会话为 404。
2. 停止 Agent Server，分别重建 PostgreSQL 和 Agent Server，保留原卷，不删除数据库。
3. node deploy/verify-local.mjs after：同 Session 历史、事件可读；只向实际模型询问旧口令，模型正确返回，
   后续请求没有携带旧口令，证明 Checkpoint 随容器重建恢复。
4. node deploy/verify-local.mjs business：实际模型调用 get_table_metadata，经已批准 HTTP MCP 返回
   Mock orders 元数据；tool.completed、evidence.added 与 Evidence API 解析均通过。
5. 数据库计数为 sessions=1、messages=6、events=14、audit=15、checkpoints=39。
6. 后端重建后，Demo/Embed/Web 三个 /api/v1/sessions 入口均返回 200。
7. 浏览器刷新并展开 iframe，历史三轮对话与业务结果可见，未要求重新手动登录。
8. node deploy/backup-local.mjs 成功产生 SQL 备份，平台与官方 Checkpoint schema 同库导出。

## 产物与边界

- 验收脚本：deploy/verify-local.mjs，支持 before/after/business。
- 截图：deploy/out/docker-acceptance.png；备份：deploy/backups，均被 Git 忽略。
- 本轮未执行 pnpm test:product-a 的独立结果未另获确认；MCP 编译由用户打包完成，实际 HTTP 调用通过。
- 真实模型、Docker 网络、数据库、Checkpoint、HTTP MCP 与备份均为实际执行；业务数据与身份源为 Mock。
- 尚不覆盖企业 IdP、真实产品 API 权限、业务 Evidence 远端再鉴权、生产 TLS 或多副本部署。
- 未删除用户文件或数据库卷，未恢复用户删除的旧本地启动脚本。

## 退出结论

本地 Docker 服务拉起和持久化恢复目标完成；生产上线不在本次通过声明内。
