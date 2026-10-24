# 智能体平台部署与更新

本文件只说明智能体平台，分组名称 assistant-agents，仅包含 postgres、agent-server、assistant-web、assistant-embed。
业务系统和 MCP 分别按其所属仓库的 deploy/README.md 部署；不再提供单独的总指南。
适用环境：Windows PowerShell、Docker Desktop Linux containers、Node22+、项目声明的 pnpm。
所有 pnpm 命令由用户本人执行，每一步成功后再继续。

## 1. 首次部署前置条件

- Product A 已按自身说明构建并启动，业务网关在 assistant-integration 网络中可访问。
- MCP 已构建并打包，deploy/out/product-a-mcp/approvals.json 存在，product-a-mcp 服务可用。
- 平台数据库端口55432、API端口3411、Web端口8080、Embed端口5511未被占用。
- 三仓默认位于 D:\Git 下；其他位置可设置 DEMO_REPO_PATH、MCP_REPO_PATH。

业务和 MCP 属于平台的外部依赖，不会被平台 pack:local 自动构建。

## 2. 初始化配置

```powershell
cd D:\Git\Deep-Agents-AI-Assistant
./deploy/initialize-local.ps1
```

随机 PostgreSQL 密码与 MCP 发现密钥保存在 deploy/.env.local，初始化只补缺失项，不覆盖既有值。
MCP 独立部署也使用其中的发现密钥，因此可以先初始化此文件，再按 MCP 仓说明启动 MCP。
模型 Key、MODEL_NAME、需要时的模型地址配置在平台已有 .env 或 deploy/.env.local 中，不要提交或发送这些文件。
启动器先加载 deploy/.env.local，再加载平台 .env，同名项以后者为准；避免重复定义数据库密码或发现密钥。

identity-http.local.json 是可信身份查询的非秘密配置，指定原业务 /me 地址、字段映射和允许的浏览器 Origin。
它与 .env.local 用途不同，不能作为临时文件删除。

## 3. 构建与启动平台

```powershell
cd D:\Git\Deep-Agents-AI-Assistant
pnpm install
pnpm lint
pnpm typecheck
pnpm test:identity-http
pnpm test
pnpm pack:local
./deploy/local-compose.ps1 start -Group agents
./deploy/local-compose.ps1 status -Group agents
```

pnpm test 已包含 test:mcp-http，不必重复执行。pack:local 构建平台并读取已审核的 MCP 批准产物，
输出 deploy/out/server、web、embed、release.json、local-mcp-approval.json，不复制业务服务进平台镜像。
Docker 只复制构建产物，启动器不执行 Maven 或 pnpm。

| 平台入口 | 地址 |
| --- | --- |
| 独立助手 | http://127.0.0.1:8080/assistant |
| Embed/Loader | http://127.0.0.1:5511 |
| Agent API 调试 | http://127.0.0.1:3411/api/v1/openapi.json |
| PostgreSQL 调试 | 127.0.0.1:55432 |

先在业务 Govern 的 http://127.0.0.1:19001 登录，再使用同一浏览器打开平台助手。
使用127.0.0.1，避免和localhost混用造成 Cookie、Origin 和 iframe 策略不一致。
独立助手应显示真实身份，不提供 Mock 身份切换；未登录应拒绝访问。

本地调试前端时可用 `pnpm dev:web`（默认 http://127.0.0.1:5173），Vite 将 `/api` 代理到 Docker agent-server（127.0.0.1:3411）。若修改了 `identity-http.local.json` 中的 `browserOrigins`，需重启 agents 组中的 `agent-server` 容器后生效。

## 4. 后续更新

平台源码有变化时，重新执行本文件第3节的门禁、pack:local 和 start -Group agents。
依赖未变时可省略 pnpm install。普通更新不必先停止所有业务服务，不删除数据库卷。
平台重启清空内存业务凭证仓，刷新宿主与助手页面重新建立认证；持久化会话仍从 PostgreSQL 读取。

MCP 实现更新但 Tool/Schema 不变时，按 MCP 仓说明更新 MCP 即可。
MCP Tool、Schema 或风险配置变化后，先在 MCP 仓完成审核和打包，再在平台执行 pnpm pack:local 并更新 agents。
更新期间旧快照拒绝漂移属于预期行为，不通过关闭批准检查处理。

模型运行时环境变量变化后，需要重建相应容器使配置生效；前端构建变量变化还需要重新打包。
不要在普通更新时删除或重建 .env.local，已有数据库卷的密码不会因改环境文件自动同步。

## 5. 状态、日志、停止和检查

以下命令在平台仓根目录执行：

```powershell
./deploy/local-compose.ps1 status -Group agents
./deploy/local-compose.ps1 logs -Group agents
./deploy/local-compose.ps1 stop -Group agents
node deploy/verify-local.mjs
```

verify-local 检查三组运行服务、基础健康及未登录拒绝，不验证模型回答或业务数据正确性。
stop 保留 assistant-agents_postgres-data，普通更新不要使用 down -v。

local-compose.ps1 仍提供可选的跨仓生命周期协调：不指定 Group 时按业务→MCP→平台启动，反序停止。
它只协调独立 Compose 项目，不改变各仓部署归属；日常平台操作使用 -Group agents。

## 6. 备份与回退

```powershell
cd D:\Git\Deep-Agents-AI-Assistant
node deploy/backup-local.mjs
```

平台会话、消息与官方 Checkpoint 的逻辑备份写入 deploy/backups，按敏感资料保管。
该脚本不备份业务 MySQL；业务备份由 Product A 自身管理。
构建产物可以重新生成，但不等于数据备份。当前镜像使用 local 标签，回退前需保留旧镜像或源码版本。
回退应用不会自动回退数据库结构；数据库变化需单独的迁移和恢复步骤。

## 7. deploy 目录用途与残留核查

核查依据：当前 package.json、三个 Compose 文件、打包/生命周期脚本、Vite 配置和仓库中的文本引用。
没有读取环境文件或备份中的秘密内容；“未使用”指不参与当前部署链路，不表示没有历史留存价值。

### 当前仍需要

| 文件或目录 | 用途 |
| --- | --- |
| README.md | 本平台部署和更新说明 |
| docker-compose.yml | 平台Server/Web/Embed基础编排 |
| docker-compose.postgres.yml | PostgreSQL、平台数据卷与测试库初始化 |
| docker-compose.local.yml | 当前真实身份接入、网络与端口覆盖 |
| local-compose.ps1 | Docker生命周期、分组顺序与产物检查 |
| initialize-local.ps1 | 初始化并保留本地秘密配置 |
| identity-http.local.json | 可信业务身份查询配置 |
| .env.local | 本地秘密，必须保留 |
| pack.mjs | 平台打包基础脚本，pack:deploy使用 |
| pack-local.mjs | 当前部署打包入口与MCP批准产物装配 |
| verify-local.mjs | 部署健康检查 |
| backup-local.mjs | 平台数据库备份 |
| build-info.mjs、build-info.d.mts | 两个Vite项目引用的构建信息与类型声明 |
| .dockerignore | 防止环境文件、备份等进入镜像构建上下文 |
| docker/server.Dockerfile、web.Dockerfile、embed.Dockerfile | 三个平台应用镜像 |
| docker/nginx/ | Web与Embed的代理、CSP、静态资源配置 |
| docker/postgres/init-test-database.sql | 初始化独立测试库 |
| docker/normalize-deploy-links.cjs | 修正Windows pnpm链接供Linux镜像使用 |

### 已清理的旧残留（2026-10-24）

| 文件 | 判定依据 |
| --- | --- |
| docker/demo.Dockerfile | 仍复制已删除的out/product-a-demo；当前业务Dockerfile已在Demo仓 |
| docker/mcp.Dockerfile | 仍复制主仓旧out/product-a-mcp；当前MCP镜像已在MCP仓 |
| acceptance-state.local | 旧版本验收脚本状态文件，当前verify-local不读取 |
| ui-demo-build.local、ui-pack.local、ui-test.local、ui-typecheck.local | 历史命令输出，无当前运行时读取引用 |

上述七个文件已按用户确认删除，不影响当前三个独立部署分组。

### 有用途但不属于部署源文件

| 目录 | 如何处理 |
| --- | --- |
| out/ | 可再生成的打包产物；当前内容可能来自旧构建，下一次pack:local会整体重建，不当作源码维护 |
| backups/ | 历史数据库备份，不参与启动，但有数据恢复价值，不能当作普通缓存删除 |
| env/ | 其他部署模式和A/B进程样例；不被当前启动器读取，部分样例仍被历史验收文档引用，适合后续单独归档或整理 |

2026-10-24 已完成三个分组的镜像构建和启动（共15个容器），部署健康检查、未登录401、真实业务身份与查询均通过。当前MCP为七个真实只读工具，host-navigation@1.0.0已按固定摘要批准并传入容器。浏览器已验证管理端/门户验证码登录、工作台数据、嵌入助手查询和按钮跳转数据源管理；详细记录见 ../docs/acceptance/evolution/product-a-real-navigation-2026-10-24.md。历史Mock工具已退出Product A源码和运行包。
