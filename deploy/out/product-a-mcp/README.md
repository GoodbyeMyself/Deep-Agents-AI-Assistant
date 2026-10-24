# Product A MCP

Product A 数据平台的独立 MCP Server（一系统一 MCP）。当前为 **多微服务 Mock**，便于后续替换真实 HTTP 客户端。

## 模拟的微服务与 Tool 映射

| 微服务（`api/clients/`） | MCP Tool（Agent 能力） |
|--------------------------|-------------------------|
| `data-governance-service` | `get_quality_trend` |
| `data-service` | `list_table_sample_rows` |
| `metadata-service` | `get_table_metadata`、`search_data_assets` |

Tool 数量应远少于 REST API 数量；`api/clients` 内可随微服务增长，不必每个 API 一个 Tool。

## 目录

```text
src/
├─ api/                       # 对接 Product A 各微服务（无 MCP）
│  ├─ auth-context.ts         # 从可信传输恢复主体（当前 Mock）
│  ├─ types.ts                # 内部 DTO
│  └─ clients/
│     ├─ metadata-service.ts
│     ├─ data-governance-service.ts
│     └─ data-service.ts
├─ schemas/
│  ├─ constants.ts
│  ├─ shared.ts
│  ├─ contracts/              # 每个 Tool 一份 Zod
│  └─ index.ts
├─ services/                  # 用例层：编排 client + 授权 + Evidence
│  ├─ authorization.ts
│  ├─ governance/
│  ├─ data-service/
│  └─ metadata/
├─ tools/                     # registerTool（MCP 协议）
├─ server.ts
├─ stdio.ts
└─ index.ts
```

## 新增一个 Tool（ checklist ）

1. `schemas/constants.ts`：`_*_TOOL_NAME`
2. `schemas/contracts/<feature>.ts`：Zod 契约
3. `schemas/index.ts`：re-export
4. `api/clients/<微服务>.ts`：新增或扩展 HTTP/Mock 方法
5. `services/<域>/<feature>.ts`：调用 client，组装 `structuredContent`
6. `tools/register-<feature>.ts` + `server.ts` 一行注册
7. `tests/server.test.mjs` + 主平台 `schemaDigest` 批准

替换真实数据：优先改 `api/clients/*` 与 `api/auth-context.ts`，Tool 契约稳定时可不动。

## Streamable HTTP（接主平台）

```powershell
pnpm --filter @business-mcp/product-a build
pnpm --filter @business-mcp/product-a serve:http
```

默认监听 `http://127.0.0.1:3101/mcp`。常用环境变量：

| 变量 | 含义 |
|------|------|
| `PRODUCT_A_MCP_HTTP_PORT` | 端口（默认 `3101`） |
| `PRODUCT_A_MCP_HTTP_PATH` | 路径（默认 `/mcp`） |
| `PRODUCT_A_MCP_REQUIRE_AUTH` | `false` 时跳过 Bearer（仅本地） |
| `PRODUCT_A_MCP_EXPECTED_BEARER` | 开发期固定 Bearer 校验 |
| `PRODUCT_A_GATEWAY_BASE_URL` | 接真 API 时统一网关根地址 |
| `PRODUCT_A_MCP_FORWARD_HEADER_PREFIXES` | 转发到网关的入站头前缀（默认 `x-product-a-`） |

主平台调用 MCP 时在 `Authorization: Bearer <统一网关Token>` 传入委托 Token；可选 `X-Subject-Id`、`X-Tenant-Id`、`X-Product-A-*` 自定义头。MCP 经 `api/gateway-fetch` 用同一 Token 调网关。

`stdio` 仍用于本地协议测试：`pnpm --filter @business-mcp/product-a serve:stdio`

## 验证

```powershell
pnpm --filter @business-mcp/product-a build
pnpm --filter @business-mcp/product-a test
```
