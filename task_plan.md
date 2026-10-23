# 本地 Docker 与 PostgreSQL 持久化实施计划

日期：2026-10-23

## 授权与约束

- 用户已授权完善部署脚本、本地 Docker 部署，并将会话、事件、审计与 Checkpoint 持久化到 PostgreSQL。
- 所有 pnpm 命令由用户执行；不得通过 Dockerfile 或其他命令绕过此限制。
- 按模块实施，不运行自动 review/修改循环，不修改无关功能，不删除现有 Docker 数据。
- 本次先交付 Product A；Product B 不自动扩展到本任务。业务身份/API 仍为 Mock，不能报告为生产集成。

## 已确定方案

- 复用三仓边界：主仓提供 Server/Web/Embed，MCP 仓提供 Product A HTTP MCP，Demo 仓提供 Product A 页面。
- Compose 服务：postgres、agent-server、assistant-web、assistant-embed、product-a-mcp、product-a-demo。
- PostgreSQL 使用命名卷；数据库和 MCP 不直接发布到公网；浏览器访问本机前端端口。
- 为现有同步内存 Store 提取可等待的 Store 契约，新增真正异步的 PostgreSQL 实现；不使用进程退出时才保存的内存镜像。
- 持久化 Session、Run、Message、ContextSnapshot、AssistantEvent、Evidence、审批中断及幂等状态。
- 平台审计独立保存操作主体、操作类别、资源 ID、结果和时间，不记录密钥、Token 或完整业务载荷。
- Run 创建/恢复使用事务和唯一约束保证幂等与每会话单活跃 Run；事件序号由事务保证。
- Checkpoint 使用官方 PostgresSaver 与稳定 thread_id；平台数据与官方 Checkpoint 表分开管理。
- 首版单 Agent Server 副本；重启将遗留 running/queued Run 标记为失败并补终态事件，不自动重放可能产生副作用的操作；已完成会话可继续，待审批恢复需通过持久化回归。
- HTTP MCP 保留 Server/Tool/Schema/risk 显式批准；容器 Host allowlist 和认证须适配，不能关闭认证后宣称生产就绪。
- 打包仍由用户 pnpm 构建，Docker 只复制已构建产物；修复打包脚本旧入口路径。
- 同步更新实施状态、ADR、部署说明与验收记录。

## 顺序与状态

1. [x] 只读检查三个仓库、现有存储、HTTP MCP、Docker 引擎及依赖兼容范围。
2. [x] 用户安装 agent-server 的 pg、官方 PostgreSQL Checkpointer 与 pg 类型依赖；读取实际安装类型。
3. [x] 存储模块标准构建、质量门禁、全量回归与 PostgreSQL 专项已由用户确认通过。
4. [x] HTTP MCP 装配与认证实际运行成功，真实模型调用已批准 Tool 并解析 Evidence。
5. [x] 三仓产物、六服务镜像/Compose、启停和备份脚本已完成，Windows 链接经镜像转换验证。
6. [x] 用户确认主仓 typecheck/lint/test/pack:local 完成；Codex 未执行 pnpm。
7. [x] 六服务已运行；数据库与后端重建后历史、事件与真实模型记忆恢复，备份成功。
8. [x] 实施状态、ADR 与本地验收报告已更新；任务完成，不推进生产接入。

## 最终结果（2026-10-24）

- 六服务运行，Node/数据库健康，三前端首页与 API 均 200。
- 真实模型 before/after/business 三阶段通过；1 会话、6 消息、14 事件、15 审计、39 Checkpoints。
- PostgreSQL 和 Agent Server 容器均重建，命名卷保留；模型在同一会话回忆出重建前的随机口令。
- Windows 绝对依赖链接及特定包自引用在镜像构建中改为相对链接，其余越界链接仍拒绝。
- 业务身份/API 数据与 Evidence 来源仍为 Mock，生产企业鉴权和远端 Evidence 再鉴权不在完成声明内。

## 验收重点

- 数据库失败时请求失败，不悄悄回退内存；迁移失败时拒绝启动。
- 跨用户/租户资源不可读；重复请求不创建重复 Run；并发同会话请求被数据库阻断。
- SSE 事件提交后可见，重启后使用原游标可重放。
- 已完成 Run 的消息和 Checkpoint 在容器重建后存在；下一次对话使用同一 thread。
- 审计可追溯至 Session/Run，敏感凭证不进入普通日志。
- 不执行 docker compose down -v 或清理其他项目资源。
