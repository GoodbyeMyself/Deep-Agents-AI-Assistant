# Product A / Product B 本地全链路启动说明

本文用于验证以下真实本地链路：

```text
Product A 页面 -> Product A Agent Server -> Product A MCP
Product B 页面 -> Product B Agent Server -> Product B MCP
```

同时包含嵌入式助手、独立 Web 助手和可选 React SDK Host 的启动方法。

## 1. 架构和验证边界

- 一个业务系统拥有一个独立 MCP 项目。
- 一个 Agent Server 可以连接一个或多个经过显式批准的 MCP Server。
- Product A/B 分别部署时，各自 Agent Server 只配置所属系统 MCP。
- `agent-server` 启动时负责启动 stdio MCP 子进程、发现 Tool、校验 Schema Digest 和风险、生成批准
  Snapshot，并把批准 Tool 注入 Deep Agents。
- 任一 MCP 连接失败、Schema 漂移、暴露额外未批准 Tool 或模型 Tool 名冲突，Agent Server 都会失败
  关闭，不会以部分 Tool Snapshot 启动。
- 本文使用的 stdio 只允许本地开发；`NODE_ENV=production` 时会被拒绝。生产环境仍需 Streamable
  HTTP、TLS、网络 allowlist、SSRF 防护、委托身份和真实业务 API。
- Product A/B 当前 MCP 数据、业务授权和 Evidence 是明确的 Mock，不代表生产业务系统已经接入。

## 2. 仓库和端口

仓库位置：

```text
E:\Deep-Agents-AI-Assistant
E:\Deep-Agents-AI-Assistant-MCP
E:\Deep-Agents-AI-Assistant-Demo
```

| 组件                          | 地址                    | 说明                  |
| ----------------------------- | ----------------------- | --------------------- |
| Product A Agent Server        | `http://127.0.0.1:3411` | 连接 Product A MCP    |
| Product B Agent Server        | `http://127.0.0.1:3412` | 连接 Product B MCP    |
| Product A Embed               | `http://127.0.0.1:5511` | Product A iframe 助手 |
| Product B Embed               | `http://127.0.0.1:5512` | Product B iframe 助手 |
| Product A Demo                | `http://127.0.0.1:5411` | React 宿主页面        |
| Product B Demo                | `http://127.0.0.1:5412` | Vue 宿主页面          |
| 独立助手 A                    | `http://127.0.0.1:5173` | 代理到 `3411`         |
| 独立助手 B（可选）            | `http://127.0.0.1:5174` | 代理到 `3412`         |
| SDK Host（可选）              | `http://127.0.0.1:5314` | React SDK 内联示例    |
| SDK Host Agent Server（可选） | `http://127.0.0.1:3310` | SDK Host 后端         |

## 3. 一次性准备

所有 `pnpm` 命令必须由用户本人执行。

### 3.1 配置模型

检查主仓根目录 `E:\Deep-Agents-AI-Assistant\.env`：

```dotenv
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=你的API地址
MODEL_NAME=deepseek-chat
SERVER_HOST=127.0.0.1
```

也可以使用 `OPENAI_API_KEY`。不要把真实密钥写入 Git、前端环境变量或本文档。

### 3.2 构建 Product A/B MCP

```powershell
cd E:\Deep-Agents-AI-Assistant-MCP
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

确认 stdio 入口存在：

```powershell
Test-Path E:\Deep-Agents-AI-Assistant-MCP\product-a-mcp\dist\stdio.js
Test-Path E:\Deep-Agents-AI-Assistant-MCP\product-b-mcp\dist\stdio.js
```

两条命令都应返回 `True`。

### 3.3 安装并构建主平台

`agent-server` 新增了 `@assistant/mcp-client-runtime` workspace 依赖，因此必须重新执行一次安装：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm install
pnpm build
```

### 3.4 安装 Demo 仓

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm install
```

## 4. 一键启动全部页面

完成上述一次性准备后，在主仓根目录执行：

```powershell
cd E:\Deep-Agents-AI-Assistant
.\start-local-development.ps1
```

也可以直接双击主仓根目录的 `start-local-development.cmd`；该入口会自动打开四个主要页面。

脚本会先检查三个仓库、Product A/B MCP 构建产物、`pnpm` 和全部端口，然后分别打开 8 个 PowerShell
窗口，启动：

- Product A/B Agent Server；
- Product A/B Embed；
- Product A/B Demo；
- 独立助手 A/B。

MCP Server 不会单独打开窗口；它们由各自 Agent Server 作为 stdio 子进程启动和关闭。脚本只设置子
终端的临时环境变量，不会修改 `.env`，也不会把密钥写入命令行参数。

每次启动日志写入 `logs/local-development/<启动时间>/`。使用 `-OpenBrowser` 时，脚本最多等待 60 秒，
只打开已经返回 HTTP 响应的页面；未就绪页面会连同日志目录打印为警告。

同时打开四个主要页面：

```powershell
.\start-local-development.ps1 -OpenBrowser
```

额外启动 SDK Host 及其同时挂载 A/B MCP 的 Agent Server：

```powershell
.\start-local-development.ps1 -IncludeSdkHost -OpenBrowser
```

如果 PowerShell 执行策略阻止脚本，可仅对本次进程放开：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local-development.ps1
```

脚本默认按同级目录推导 MCP 和 Demo 仓库。目录不同时可显式传入：

```powershell
.\start-local-development.ps1 `
  -McpRepository 'E:\Deep-Agents-AI-Assistant-MCP' `
  -DemoRepository 'E:\Deep-Agents-AI-Assistant-Demo'
```

若脚本提示端口被占用，先到已有服务窗口按 `Ctrl+C`，再重新运行。脚本不会自动终止已有进程。

只检查路径、构建产物、端口和待启动命令，不创建进程：

```powershell
.\start-local-development.ps1 -DryRun
```

## 5. 先验证 Agent Server MCP 装配

建议先完成本节，再启动所有页面。

### 5.1 配置解析和平台 MCP Runtime 测试

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm test:mcp-1
```

### 5.2 同一个 Agent Server 同时挂载两个 MCP

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:MCP_TEST_SERVERS=@'
[
  {
    "serverId": "product-a-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-a-mcp/dist/stdio.js",
    "approvals": [
      {
        "toolName": "get_quality_trend",
        "schemaDigest": "1e186399a946e06fc251f535634a99d0321b409c8c2eb190b97e3a397745812e",
        "riskLevel": "read"
      },
      {
        "toolName": "list_table_sample_rows",
        "schemaDigest": "03f9da7b21f7b939067086a0a4ce73fd4616a8775adab5521a1a4d01a5b8ec02",
        "riskLevel": "read"
      },
      {
        "toolName": "get_table_metadata",
        "schemaDigest": "2d2e31afa7ad70790db3d6be316135f46929f2cba0e16e1d06ebec2d41cf17ab",
        "riskLevel": "read"
      },
      {
        "toolName": "search_data_assets",
        "schemaDigest": "2036488ae65f79f663b176ba9c77c6534169df8d24b6e17b5f8f5a008b0fb761",
        "riskLevel": "read"
      }
    ],
    "toolArguments": {
      "tableId": "orders",
      "startTime": "2026-10-07T00:00:00+08:00",
      "endTime": "2026-10-14T00:00:00+08:00"
    }
  },
  {
    "serverId": "product-b-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-b-mcp/dist/stdio.js",
    "approvals": [
      {
        "toolName": "list_open_work_orders",
        "schemaDigest": "61548a2b7784e93e18fa8b5c58ba6d3535d7a1de443c8d853b7837b90778b4ee",
        "riskLevel": "read"
      }
    ],
    "toolArguments": {
      "siteCode": "east-plant",
      "priorities": ["critical", "high"],
      "limit": 10
    }
  }
]
'@

pnpm test:mcp-1:stdio:multi
```

预期结果：测试通过，且同一个 Composition Root 同时发现、批准、挂载并调用两个 MCP Tool。

## 6. 手工启动 Product A 全链路

以下三个命令需要在三个独立 PowerShell 窗口中运行并保持窗口打开。

### 6.1 Product A Agent Server + Product A MCP

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3411'
$env:DEPLOYMENT_ID='local-product-a'
$env:MCP_DEVELOPMENT_STDIO='true'
$env:MCP_SERVERS=@'
[
  {
    "serverId": "product-a-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-a-mcp/dist/stdio.js",
    "approvals": [
      {
        "toolName": "get_quality_trend",
        "schemaDigest": "1e186399a946e06fc251f535634a99d0321b409c8c2eb190b97e3a397745812e",
        "riskLevel": "read"
      },
      {
        "toolName": "list_table_sample_rows",
        "schemaDigest": "03f9da7b21f7b939067086a0a4ce73fd4616a8775adab5521a1a4d01a5b8ec02",
        "riskLevel": "read"
      },
      {
        "toolName": "get_table_metadata",
        "schemaDigest": "2d2e31afa7ad70790db3d6be316135f46929f2cba0e16e1d06ebec2d41cf17ab",
        "riskLevel": "read"
      },
      {
        "toolName": "search_data_assets",
        "schemaDigest": "2036488ae65f79f663b176ba9c77c6534169df8d24b6e17b5f8f5a008b0fb761",
        "riskLevel": "read"
      }
    ]
  }
]
'@

pnpm dev:server
```

预期启动日志包含：

```text
Agent Server listening for deployment 'local-product-a' on http://127.0.0.1:3411 with MCP Servers 'product-a-mcp'
```

不需要再单独执行 `pnpm serve:product-a`；Agent Server 会自行启动并管理 stdio 子进程。

### 6.2 Product A Embed

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_EMBED_PORT='5511'
$env:ASSISTANT_API_TARGET='http://127.0.0.1:3411'
$env:ASSISTANT_HOST_ORIGIN='http://127.0.0.1:5411'

pnpm dev:embed
```

### 6.3 Product A Demo

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:product-a
```

打开：<http://127.0.0.1:5411>

## 7. 手工启动 Product B 全链路

以下三个命令也需要在三个独立 PowerShell 窗口中运行。

### 7.1 Product B Agent Server + Product B MCP

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3412'
$env:DEPLOYMENT_ID='local-product-b'
$env:MCP_DEVELOPMENT_STDIO='true'
$env:MCP_SERVERS=@'
[
  {
    "serverId": "product-b-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-b-mcp/dist/stdio.js",
    "approvals": [
      {
        "toolName": "list_open_work_orders",
        "schemaDigest": "61548a2b7784e93e18fa8b5c58ba6d3535d7a1de443c8d853b7837b90778b4ee",
        "riskLevel": "read"
      }
    ]
  }
]
'@

pnpm dev:server
```

预期启动日志包含：

```text
Agent Server listening for deployment 'local-product-b' on http://127.0.0.1:3412 with MCP Servers 'product-b-mcp'
```

不需要再单独执行 `pnpm serve:product-b`。

### 7.2 Product B Embed

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_EMBED_PORT='5512'
$env:ASSISTANT_API_TARGET='http://127.0.0.1:3412'
$env:ASSISTANT_HOST_ORIGIN='http://127.0.0.1:5412'

pnpm dev:embed
```

Product A/B 必须使用各自 Embed 实例，因为 CSP `frame-ancestors` 精确绑定宿主 Origin。

### 7.3 Product B Demo

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:product-b
```

打开：<http://127.0.0.1:5412>

## 8. 手工启动独立 Web 助手

### 8.1 连接 Product A Agent Server

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_API_TARGET='http://127.0.0.1:3411'
$env:ASSISTANT_WEB_PORT='5173'

pnpm dev:web
```

打开：<http://127.0.0.1:5173>

### 8.2 同时连接 Product B Agent Server（可选）

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_API_TARGET='http://127.0.0.1:3412'
$env:ASSISTANT_WEB_PORT='5174'

pnpm dev:web
```

打开：<http://127.0.0.1:5174>

在独立助手中切换到“平台管理员”，然后打开“运行状态”：

- A 实例应显示 `product-a-mcp` 的 4 个批准 Tool：`get_quality_trend`、
  `list_table_sample_rows`、`get_table_metadata`、`search_data_assets`；
- B 实例应显示 `product-b-mcp` 和 `list_open_work_orders`；
- MCP Server 状态应为 `ready`；
- Tool 状态应为 `approved`。

## 9. React SDK Host（可选）

SDK Host 的 API 代理固定指向 `3310`，因此需要额外 Agent Server。下面示例让它同时连接 A/B 两个 MCP。

### 9.1 SDK Host Agent Server

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3310'
$env:DEPLOYMENT_ID='local-sdk-host'
$env:MCP_DEVELOPMENT_STDIO='true'
$env:MCP_SERVERS=@'
[
  {
    "serverId": "product-a-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-a-mcp/dist/stdio.js",
    "approvals": [
      {
        "toolName": "get_quality_trend",
        "schemaDigest": "1e186399a946e06fc251f535634a99d0321b409c8c2eb190b97e3a397745812e",
        "riskLevel": "read"
      },
      {
        "toolName": "list_table_sample_rows",
        "schemaDigest": "03f9da7b21f7b939067086a0a4ce73fd4616a8775adab5521a1a4d01a5b8ec02",
        "riskLevel": "read"
      },
      {
        "toolName": "get_table_metadata",
        "schemaDigest": "2d2e31afa7ad70790db3d6be316135f46929f2cba0e16e1d06ebec2d41cf17ab",
        "riskLevel": "read"
      },
      {
        "toolName": "search_data_assets",
        "schemaDigest": "2036488ae65f79f663b176ba9c77c6534169df8d24b6e17b5f8f5a008b0fb761",
        "riskLevel": "read"
      }
    ]
  },
  {
    "serverId": "product-b-mcp",
    "serverEntry": "E:/Deep-Agents-AI-Assistant-MCP/product-b-mcp/dist/stdio.js",
    "approvals": [{
      "toolName": "list_open_work_orders",
      "schemaDigest": "61548a2b7784e93e18fa8b5c58ba6d3535d7a1de443c8d853b7837b90778b4ee",
      "riskLevel": "read"
    }]
  }
]
'@

pnpm dev:server
```

### 9.2 SDK Host 页面

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:sdk-host
```

打开：<http://127.0.0.1:5314>

## 10. 页面端到端验收

### 10.1 Product A

在 <http://127.0.0.1:5411> 展开助手，使用明确测试语句：

```text
请查询 orders 表从 2026-10-07T00:00:00+08:00 到 2026-10-14T00:00:00+08:00 的数据质量趋势，并给出证据。
```

检查：

- 运行时间线出现 `mcp_product-a-mcp_get_quality_trend`；
- 返回 Product A Mock 质量趋势；
- Evidence 引用以 `product-a:mcp:quality:` 开头；
- Product B Tool 没有出现在该部署状态中。

### 10.2 Product B

在 <http://127.0.0.1:5412> 展开助手，使用明确测试语句：

```text
请查询 east-plant 中 critical 和 high 优先级的未完成维护工单，最多返回 10 条，并给出证据。
```

检查：

- 运行时间线出现 `mcp_product-b-mcp_list_open_work_orders`；
- 返回 Product B Mock 工单；
- Evidence 引用以 `product-b:mcp:work-orders:` 开头；
- Product A Tool 没有出现在该部署状态中。

### 10.3 ContextSnapshot

在 Product A/B 页面切换业务对象后再提问：

- 新 Run 应使用新的页面 Context；
- 已经开始的 Run 必须继续使用创建时固定的 ContextSnapshot；
- 页面 Context、Prompt 和模型生成参数都不能授予业务权限。

## 11. 常见问题

### Agent Server 报找不到 `@assistant/mcp-client-runtime`

在主仓重新执行：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm install
```

### Agent Server 报 Schema approval drift

说明 MCP Tool Schema 已改变，不能自动批准。重新执行 MCP 测试、人工检查新 Schema，然后更新部署
批准中的 `schemaDigest`。不要跳过摘要校验或自动接受发现结果。

### Agent Server 启动后显示 `without MCP Servers`

当前终端没有设置 `MCP_DEVELOPMENT_STDIO=true` 和 `MCP_SERVERS`，或者它们被设置为空值。请在运行
`pnpm dev:server` 的同一个 PowerShell 窗口中设置。

### 打开多个 PowerShell 窗口，但所有端口都未监听

启动脚本固定调用 `pnpm.cmd`，避免 Windows `RemoteSigned` 策略阻止未签名的 `pnpm.ps1`。如果服务仍未
监听，查看脚本打印的 `logs/local-development/<启动时间>/`；每个 Agent Server、Embed、Demo 和独立
助手都有单独的 transcript。

### 页面能打开但没有助手按钮

检查：

- Product A Embed 是否运行在 `5511`；
- Product B Embed 是否运行在 `5512`；
- `ASSISTANT_HOST_ORIGIN` 是否与 `5411`/`5412` 完全一致；
- 浏览器控制台是否出现 CSP、脚本加载或跨 Origin 错误。

### 助手能聊天但没有调用 MCP Tool

检查：

- Agent Server 启动日志是否包含正确的 MCP Server；
- 独立助手“运行状态”是否显示批准 Tool；
- 问题是否明确包含 Tool 所需业务参数；
- 模型服务是否真实可用；
- Agent Server 终端是否出现 Tool、模型或回答发布门禁错误。

### 是否需要手工启动 MCP Server

不需要。Agent Server 根据 `serverEntry` 启动和关闭 stdio 子进程。手工执行 `pnpm serve:product-a` 或
`pnpm serve:product-b` 只会产生未被 Agent Server 使用的额外进程。

## 12. 完整质量门禁

完成页面验收后，由用户执行：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Demo 仓：

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm typecheck
pnpm build
```

## 13. 停止服务

在每个运行服务的 PowerShell 窗口中按 `Ctrl+C`。Agent Server 会关闭它启动的全部 MCP 连接和 stdio
子进程。PowerShell 窗口关闭后，该窗口中设置的临时环境变量也会消失。
