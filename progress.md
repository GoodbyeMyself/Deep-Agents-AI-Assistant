# 实施进度

## 2026-10-23

- 完成当前部署与存储实现的只读调研，确认 Docker 可用。
- 读取 brainstorming、planning-with-files、postgresql-table-design 技能；不执行与用户禁令冲突的 spec/review 自动循环。
- 将用户已授权的部署方向细化为 Product A 单实例、PostgreSQL Store + 官方 Checkpointer、HTTP MCP 的分模块计划。
- 新增计划与调研记录。业务代码、依赖清单、Compose 尚未修改。
- 用户已完成依赖安装，已读取实际 PostgresSaver 类型并接入共享连接池。
- 已实现存储契约、数据库表、PostgreSQL Store、官方 Checkpointer、事务化终态、审计、单实例租约和遗留 Run 恢复；已适配 Service/Runner/HTTP/AG-UI 的数据库等待。
- 新增真实数据库专项测试及 pnpm test:postgres，明确要求独立 _test 数据库。
- 创建随机数据库凭证（已忽略）与初始化脚本，真实启动 PostgreSQL 17 Docker 容器，健康检查通过。
- 创建独立 assistant_test 测试库；应用库 assistant 已由镜像初始化。平台表和官方 Checkpoint 表需在应用或专项测试启动时迁移。
- 用户工作区的两个 start-local-development 脚本出现非本任务删除，已保留，未恢复或覆盖。
- ADR-030 与实施状态已更新；lint/typecheck/build/test 未执行，待用户提供标准命令结果后继续 HTTP MCP 和整套应用容器化。

## 用户全量测试反馈与定向修复

- 用户提供 pnpm test 真实输出：Agent Server 及依赖构建通过，MCP 测试 11/11；平台扩展 8/10，全量流程在此停止，后续测试没有执行。
- 失败一：诊断 Tool 已中文化，测试仍匹配英文 system MCP；已同步为中文断言。
- 失败二：.gitattributes 只指向旧 packages/platform-diagnostics-extension/skills 目录，迁移后的 Skill 未强制 LF。
  只读哈希计算确认 CRLF 摘要 ebe782b1… 不匹配，而 LF 摘要 47a750c7… 与 Manifest 完全相同。
- 已将当前 extensions/*/skills/** 配置为 LF，并把现有 Skill 文件换行为 LF；未修改批准摘要或放宽 Runtime 校验。
- git 属性与差异检查通过；标准平台扩展测试与全量测试仍待用户重新执行。

## 2026-10-24：HTTP MCP 与六服务 Docker 配置

- 用户确认上一轮全部门禁通过，包括 PostgreSQL 专项；存储模块进入后续部署阶段。
- 新增固定目标 HTTP transport、DNS 地址固定、拒绝重定向、大小和超时上限；应用 Composition Root 增加本地 HTTP MCP 配置。
- 本地演示采用 60 秒、固定 audience 的 HMAC 委托凭证，逐调用从服务端 Runtime Context 获取主体；每次调用独立连接并重新检查 Schema 批准，发现凭证不能调用 Tool。
- Product A MCP 增加显式 Host allowlist、签名校验、健康接口与请求大小限制。真实业务权限仍是 Mock，未引入企业 IdP 或假称生产认证完成。
- 新增主仓 pack:local、本地 Compose/MCP/Demo Dockerfile、初始化/启动/停止/备份脚本，MCP 仓新增独立 pack:product-a。Dockerfile 均不运行 pnpm。
- 补充 Embed 静态模块的 CORS，维持 Demo 5411、Embed 5511、后端 3411、Web 8080。
- 用户选择 DeepSeek，并已在主仓 .env 配置模型。Compose 先加载本地环境，再加载主仓 .env，避免空 Key 或默认模型覆盖用户配置；未读取或输出密钥。
- 六服务 docker compose config --quiet 通过；PowerShell 脚本解析、Node 脚本/测试语法与 git diff --check 通过。
- 本轮新增 TypeScript、HTTP MCP 专项与打包尚未执行；需用户运行 pnpm 命令后继续 Docker 镜像构建和真实重启验收。

## 本地镜像启动：Windows 部署链接阻断

- 用户已确认 pnpm typecheck/lint/test/pack:local 全部执行完毕，deploy/out 六项产物存在。
- 五个应用镜像首次构建完成；MCP 容器 ERR_MODULE_NOT_FOUND，导致后端及前端依赖启动未完成。
- 只读检查确认 Windows pnpm deploy 的绝对 junction 被 Docker 复制为 D:/... 符号链接。
- 新增 Docker 阶段 normalize-deploy-links.cjs，映射虚拟存储链接到镜像内相对路径，不运行 pnpm。
- 第二次构建被检查器主动拒绝：产物中各有一个源码目录自引用链接，不在虚拟存储内。
  MCP 为 node_modules/.pnpm/node_modules/@business-mcp/product-a -> MCP 仓 product-a-mcp；
  Server 为 node_modules/.pnpm/node_modules/@assistant/agent-server -> 主仓 apps/agent-server。
- 下一步仅应将与 package.json.name 完全匹配的上述自引用链接映射到镜像包根，保留其他逃逸链接拒绝规则。
- 根据用户 AGENTS 循环保护，本轮已停止继续修改/重建，等待用户确认；停止失败 MCP 容器，保留 PostgreSQL 与卷。
- 新增 deploy/verify-local.mjs，供真实部署后验证前端、模型对话、重建后记忆恢复和业务 MCP/Evidence；尚未执行。

## 用户授权继续后的最终部署验收

- 用户明确授权修复直到所有服务启动。仅允许 package.json.name 对应的包自引用链接映射到镜像包根，其余越界链接仍拒绝。
- MCP 镜像验证 9 个链接，Server 镜像验证 284 个链接；五个应用镜像完成，六服务实际启动。
- 后端日志确认 PostgreSQL 与官方 Checkpointer 初始化成功，已批准 product-a-mcp 与 host-navigation 装配成功。
- node deploy/verify-local.mjs before 通过：5411/5511/8080 首页、Loader CORS、HTTP MCP 状态、真实 DeepSeek 对话、跨用户 404。
- 停止后端后，分别 force-recreate PostgreSQL 与 Agent Server 并复用原卷；未执行 down -v。
- node deploy/verify-local.mjs after 通过：历史消息、事件重放和同 Session 的实际模型随机口令记忆恢复。
- node deploy/verify-local.mjs business 通过：实际模型调用 HTTP MCP，Mock 业务 Tool 结果与 Evidence 解析成功。
- PostgreSQL 查询只读取计数：sessions=1、messages=6、events=14、audit=15、checkpoints=39。
- 三个 Nginx 入口重建后 /api/v1/sessions 均 200；浏览器刷新、展开 iframe 后历史与业务结果正常显示。
- 备份脚本实际执行成功，SQL 位于忽略的 deploy/backups；截图保存 deploy/out/docker-acceptance.png。
- 新增 .cjs 部署助手对应 Node ESLint globals 配置；最后这些脚本/配置修改未由 Codex 复跑 pnpm，标准门禁以用户已提供的上一轮结果为准。
- 本地部署验收完成。业务 API/身份仍为 Mock；不宣称生产 IdP、真实业务权限或远端 Evidence 再鉴权完成。
