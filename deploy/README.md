# 部署目录

`deploy/` 是运行与部署说明目录，不是业务源码目录。同一发行版可为 Product A / Product B 配置两套**彼此隔离**的实例：各只批准自己的 `PLUGIN_ID`，使用各自的插件目录、模型密钥、Session Repository 与 LangGraph Checkpointer。

当前可运行服务器默认使用内存 Store/Checkpointer，适合本地与 M5 验收；生产必须注入独立持久化实现后才有重启恢复能力。

```text
deploy/
├─ docker-compose.yml              # 一个产品实例：Agent Server + Web + Embed
├─ docker/                         # 镜像定义，镜像内容来自 out/
├─ env/
│  ├─ product-a.example           # Docker Compose — Product A
│  ├─ product-b.example           # Docker Compose — Product B
│  ├─ process-product-a.example   # 裸进程双实例 — Product A（默认 3101）
│  └─ process-product-b.example   # 裸进程双实例 — Product B（默认 3102）
├─ pack.mjs                        # pnpm pack:deploy
└─ out/                            # 打包产物，不提交
```

环境变量边界对**容器**与**裸进程**同样有效。反向代理负责 TLS、请求体上限和生产 CSP。服务默认绑定 `127.0.0.1`；仅在受控网络与反向代理就绪后修改 `SERVER_HOST`。

## 本地同时测两个 Agent Server（裸进程 A/B）

用于 M5 式验收：同一台机器上跑两个 `apps/agent-server` 进程，分别只装 `demo-product-a` / `demo-product-b`，端口与配置互不共享。与 `pnpm demo`（演示业务页 + demo-server）无关。

1. 执行 `pnpm install --frozen-lockfile`、`pnpm build` 及仓库质量门禁。
2. 复制进程环境样例到不受版本控制的文件（勿提交密钥），例如：
   - `deploy/env/process-product-a.example` → `deploy/.env.process-product-a`
   - `deploy/env/process-product-b.example` → `deploy/.env.process-product-b`
3. 在两个文件中分别填入该实例的 `DEEPSEEK_API_KEY`。`PLUGINS_DIR` 可指向 `adapters/demo-product-*` 源码目录，或 `pnpm pack:deploy` 后 `deploy/out/plugins/<PLUGIN_ID>/` 的只读发布目录；生产须校验 `plugin.json` 与入口哈希。
4. 在仓库根目录开**两个终端**，分别启动：

```bash
node --env-file=deploy/.env.process-product-a --import tsx apps/agent-server/src/server-main.ts
node --env-file=deploy/.env.process-product-b --import tsx apps/agent-server/src/server-main.ts
```

5. 启动探针：各实例访问 `/api/v1/openapi.json`、管理员插件状态，以及一次受权能力调用。A/B 必须使用不同端口、密钥文件、存储与 Checkpointer 命名空间（默认 3101 / 3102）。

- Product A API：<http://127.0.0.1:3101>
- Product B API：<http://127.0.0.1:3102>

日常单实例开发仍可用根目录 `.env` 与 `pnpm dev:server`（默认一个进程、端口 3000）。

## 容器打包与启动

先在仓库根目录执行 `pnpm pack:deploy`。脚本会构建 Agent Server、独立 Web、iframe 助手和 `adapters/` 下每个带 `plugin.json` 的适配器，产物位于 `deploy/out/`。

```bash
pnpm pack:deploy
```

新增适配器：源码放在 `adapters/<目录>/`，提供 `plugin.json` 与可构建的 `package.json`，再次打包后产物在 `deploy/out/plugins/<plugin.json 里的 id>/`。容器不扫描 `adapters/` 源码。

复制 Compose 环境样例并填入模型密钥（勿提交填好的文件）：

```bash
cp deploy/env/product-a.example deploy/.env
```

在仓库根目录构建并启动：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

- 独立 Web：<http://127.0.0.1:8080>
- iframe 助手：<http://127.0.0.1:8081>
- Agent Server 在 Compose 网络内监听 `3000`，由 Nginx 反向代理 `/api/`

Product B 使用另一 Compose 项目名与端口，避免覆盖 Product A：

```bash
cp deploy/env/product-b.example deploy/.env.product-b
docker compose --env-file deploy/.env.product-b -p assistant-b -f deploy/docker-compose.yml up -d --build
```

- Product B Web：<http://127.0.0.1:8090>
- Product B iframe：<http://127.0.0.1:8091>

`FRAME_ANCESTORS` 为允许嵌入 iframe 的宿主 Origin，多个用空格分隔。更换插件或重新打包后需重新 `--build`。Agent Server 镜像标签为 `assistant-agent-server:<PLUGIN_ID>`。

## 插件接入

以 `adapters/demo-product-a` 或 `adapters/demo-product-b` 为样例：通过 `plugin-sdk` 的 `definePlugin` / `implementCapability` 只映射标准 Capability 输入输出；Adapter 与原业务 API 再次执行对象、行列与脱敏授权。构建后生成 manifest 完整性值，将插件放入实例安装目录并加入批准列表。Agent、Tool Factory 与 Shared Chat Core 不得增加产品名分支。

## 升级

1. 在隔离环境对新构建执行契约测试、安全测试、A/B 系统测试和浏览器 E2E。
2. 备份数据库并检查迁移的向前/回滚策略；先部署独立实例或金丝雀。
3. 停止接收新 Run，等待运行中 Run 进入终态，再替换应用与已审批插件产物。
4. 启动后核验插件状态、标准能力集合、模型版本、错误率、超时与 Evidence 解引用。

## 回滚

保留上一版本应用、插件产物、manifest 与数据库备份。发生契约、权限、Evidence 或错误率异常时停止新流量，恢复上一组经校验的产物；数据库仅按已演练的向下迁移或备份恢复。不得只回滚 Adapter 而保留不兼容的契约版本。内存实现重启会丢失会话，不能作为生产回滚方案。

## 可观测性与告警

至少采集 Run 终态与耗时、Tool/Provider 耗时与超时、SSE 断开/重连、插件启动失败、Capability 标准错误码、Evidence 二次鉴权拒绝以及模型调用失败。日志只记录 trace/run/session/plugin/capability 标识与安全错误码，不记录密钥、完整 Prompt、业务原始响应或 PII。仓库已提供结构化 Run 事件与 Capability Audit，尚未接入生产指标后端与告警平台。

## 当前边界

容器与裸进程下的身份、业务数据与会话仍为 Mock 与内存实现；重启后会话不恢复。模型密钥仅通过环境变量注入，不写入镜像。生产需替换企业身份源、真实业务 API、持久化存储与官方持久化 Checkpointer。
