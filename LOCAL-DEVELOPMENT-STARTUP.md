# 本地全页面启动说明

本文用于在本机同时启动以下页面和服务：

- Product A 演示宿主
- Product B 演示宿主
- Product A 嵌入式助手
- Product B 嵌入式助手
- 独立 Web 助手
- 可选的 React SDK 内联助手示例

## 1. 当前验证边界

当前 `agent-server` 的正式启动入口尚未自动连接 Product A/B MCP。此前通过的
`test:mcp-1:stdio` 是独立的跨仓 stdio 集成测试。

因此，本文命令当前可以验证：

- Product A/B 宿主页面；
- iframe 助手加载、Origin 限制和 Host Context 同步；
- Session、Run、AG-UI/SSE 和模型交互；
- 独立助手和 React SDK 内联助手。

当前不能从页面完整验证以下链路：

```text
Product A 页面 -> Product A Agent Server -> Product A MCP
Product B 页面 -> Product B Agent Server -> Product B MCP
```

该链路还需要在 `agent-server` Composition Root 中增加 MCP 连接、发现、批准和 Tool 注入。

## 2. 仓库位置

本文假定三个仓库位于：

```text
E:\Deep-Agents-AI-Assistant
E:\Deep-Agents-AI-Assistant-MCP
E:\Deep-Agents-AI-Assistant-Demo
```

## 3. 端口规划

| 组件 | 地址 | 说明 |
| --- | --- | --- |
| Product A Agent Server | `http://127.0.0.1:3411` | Product A 演示后端 |
| Product B Agent Server | `http://127.0.0.1:3412` | Product B 演示后端 |

| Product A Embed | `http://127.0.0.1:5511` | 仅允许 Product A Host 嵌入 |
| Product B Embed | `http://127.0.0.1:5512` | 仅允许 Product B Host 嵌入 |

| Product A Demo | `http://127.0.0.1:5411` | React 宿主页面 |
| Product B Demo | `http://127.0.0.1:5412` | Vue 宿主页面 |

| 独立助手 A | `http://127.0.0.1:5173` | 代理 Product A Agent Server |
| 独立助手 B（可选） | `http://127.0.0.1:5174` | 代理 Product B Agent Server |

| SDK Host（可选） | `http://127.0.0.1:5314` | React SDK 内联示例 |
| SDK Host Agent Server（可选） | `http://127.0.0.1:3310` | SDK Host 演示后端 |

## 4. 首次准备

### 4.1 模型配置

在主仓根目录创建或检查 `.env`：

```dotenv
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=你的API地址
MODEL_NAME=deepseek-chat
SERVER_HOST=127.0.0.1
```

不要提交真实模型密钥。

### 4.2 安装与构建

所有 `pnpm` 命令必须由用户本人执行。

主仓：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm install
pnpm build
```

Demo 仓：

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm install
```

## 5. 启动 Product A

以下命令分别在独立 PowerShell 窗口执行，并保持窗口运行。

### 5.1 Product A Agent Server

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3411'
$env:DEPLOYMENT_ID='local-product-a'

pnpm dev:server
```

### 5.2 Product A 嵌入式助手

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_EMBED_PORT='5511'
$env:ASSISTANT_API_TARGET='http://127.0.0.1:3411'
$env:ASSISTANT_HOST_ORIGIN='http://127.0.0.1:5411'

pnpm dev:embed
```

### 5.3 Product A Demo

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:product-a
```

浏览器打开：<http://127.0.0.1:5411>

## 6. 启动 Product B

### 6.1 Product B Agent Server

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3412'
$env:DEPLOYMENT_ID='local-product-b'

pnpm dev:server
```

### 6.2 Product B 嵌入式助手

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_EMBED_PORT='5512'
$env:ASSISTANT_API_TARGET='http://127.0.0.1:3412'
$env:ASSISTANT_HOST_ORIGIN='http://127.0.0.1:5412'

pnpm dev:embed
```

Product A/B 必须分别启动 Embed 实例。`frame-ancestors` 会绑定各自宿主 Origin，两个宿主不能共用
同一个 Embed 端口和配置。

### 6.3 Product B Demo

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:product-b
```

浏览器打开：<http://127.0.0.1:5412>

## 7. 启动独立 Web 助手

### 7.1 连接 Product A

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_API_TARGET='http://127.0.0.1:3411'
$env:ASSISTANT_WEB_PORT='5173'

pnpm dev:web
```

浏览器打开：<http://127.0.0.1:5173>

### 7.2 同时连接 Product B（可选）

另开一个 PowerShell 窗口：

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:ASSISTANT_API_TARGET='http://127.0.0.1:3412'
$env:ASSISTANT_WEB_PORT='5174'

pnpm dev:web
```

浏览器打开：<http://127.0.0.1:5174>

## 8. 启动 React SDK 内联示例（可选）

SDK Host 的 API 代理固定指向 `3310`，因此需要额外启动一个 Agent Server。

### 8.1 SDK Host Agent Server

```powershell
cd E:\Deep-Agents-AI-Assistant

$env:SERVER_HOST='127.0.0.1'
$env:SERVER_PORT='3310'
$env:DEPLOYMENT_ID='local-sdk-host'

pnpm dev:server
```

### 8.2 SDK Host 页面

```powershell
cd E:\Deep-Agents-AI-Assistant-Demo
pnpm dev:sdk-host
```

浏览器打开：<http://127.0.0.1:5314>

## 9. 手动验证顺序

1. 打开 Product A，确认页面正常显示，右下角助手按钮可以展开。
2. 打开 Product B，确认页面正常显示，右下角助手按钮可以展开。
3. 在 Product A/B 页面切换业务对象，确认下一次请求使用更新后的 Host Context。
4. 确认已有 Run 的 ContextSnapshot 不会被后续页面切换覆盖。
5. 打开独立助手，确认可以创建 Session、发送消息和接收运行事件。
6. 在浏览器 Network 中确认 `/api` 请求没有 `404`、`500` 或 CORS 错误。
7. 在 Agent Server 终端确认没有模型密钥、模型地址或认证错误。
8. 若启动 SDK Host，确认内联助手能够连接 `3310` 后端。

## 10. 常见问题

### 页面正常，但助手请求失败

检查对应 Agent Server 是否已经启动，以及前端代理目标是否匹配：

- Product A：`3411`
- Product B：`3412`
- SDK Host：`3310`

### Product A/B 页面没有助手按钮

检查对应 Embed 服务：

- Product A：`5511`
- Product B：`5512`

并检查 `ASSISTANT_HOST_ORIGIN` 是否与宿主页面 Origin 完全一致。

### Agent Server 启动时报模型配置错误

确认主仓根目录 `.env` 中存在有效的 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。不要把密钥写入命令、
文档、Git 或前端环境变量。

### MCP Server 是否需要同时启动

当前页面启动流程不需要单独运行 `serve:product-a` 或 `serve:product-b`。即使 MCP Server 已启动，当前
`agent-server` 正式入口也尚未自动连接它们。MCP stdio 能力目前通过以下命令独立验证：

```powershell
cd E:\Deep-Agents-AI-Assistant
pnpm test:mcp-1:stdio
```

执行前需要按 Product A 或 Product B 配置 `MCP_SERVER_ENTRY`、`MCP_SERVER_ID` 和
`MCP_TEST_TOOL_ARGUMENTS`。

## 11. 停止服务

在每个运行服务的 PowerShell 窗口中按 `Ctrl+C`。关闭终端后，PowerShell 中设置的临时环境变量也会
随该终端会话消失。
