# 容器部署目录

`deploy/` 是运行目录，不是源码目录。先在仓库根目录执行 `pnpm pack:deploy`，脚本会构建 Agent Server、独立 Web、iframe 助手和 `adapters/` 下每个带 `plugin.json` 的适配器，再把可运行产物放到 `deploy/out/`。

```text
deploy/
├─ docker-compose.yml          # 一个产品实例：Agent Server + Web + Embed
├─ docker/                     # 镜像定义，镜像内容来自 out/
├─ env/                        # A/B 两套实例的环境样例
├─ pack.mjs                    # pnpm pack:deploy
└─ out/                        # 生成的产物，不提交
   ├─ server/                  # Agent Server 与生产依赖
   ├─ web/                     # 独立 Web 静态文件
   ├─ embed/                   # iframe 助手与 assistant-loader.js
   ├─ plugins/
   │  ├─ demo-product-a/       # plugin.json、dist/index.js、生产依赖
   │  └─ demo-product-b/
   └─ release.json
```

一个容器实例只批准一个 `PLUGIN_ID`。Product A 和 Product B 使用不同的 Compose 项目名、端口和插件，不共享会话或 Checkpointer。

## 打包

在仓库根目录执行：

```bash
pnpm pack:deploy
```

新增业务适配器时，把源码放在 `adapters/<插件目录>/`，并提供 `plugin.json` 与可构建的 `package.json`。再次执行 `pnpm pack:deploy` 后，产物出现在 `deploy/out/plugins/<plugin.json 里的 id>/`。容器不会扫描 `adapters/` 源码。

## 启动一个实例

复制环境样例并填入模型密钥，不要把填好的文件提交：

```bash
cp deploy/env/product-a.example deploy/.env
```

在仓库根目录构建并启动：

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

- 独立 Web：<http://127.0.0.1:8080>
- iframe 助手：<http://127.0.0.1:8081>
- Agent Server 只在 Compose 网络内监听 `3000`，由两个 Nginx 反向代理 `/api/`

Product B 使用另一套项目名和端口，避免覆盖 Product A 的容器：

```bash
cp deploy/env/product-b.example deploy/.env.product-b
docker compose --env-file deploy/.env.product-b -p assistant-b -f deploy/docker-compose.yml up -d --build
```

- Product B Web：<http://127.0.0.1:8090>
- Product B iframe：<http://127.0.0.1:8091>

`FRAME_ANCESTORS` 填写允许嵌入 iframe 的宿主 Origin，多个 Origin 用空格分隔。更换插件或重新打包后，需要重新 `--build`。插件被打进对应的 Agent Server 镜像，镜像标签是 `assistant-agent-server:<PLUGIN_ID>`。

## 当前边界

容器里的身份、业务数据和会话仍是 Mock 与内存实现。容器重启后会话不会恢复。模型密钥只通过环境变量注入，不会写入镜像。生产接入仍需替换企业身份源、真实业务 API、持久化存储和官方持久化 Checkpointer。
