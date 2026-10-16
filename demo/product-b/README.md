# Product B Web Demo

Product B 数据资产驾驶舱。宿主采用 Vue 3 + Element Plus + Vite，用于验证不同前端框架、产品术语、页面结构和 Adapter 仍可复用相同 iframe Assistant 与标准 Capability。

## 本地端口

- Web：`http://127.0.0.1:5412`
- Agent Server：`http://127.0.0.1:3412`
- iframe Assistant：`http://127.0.0.1:5512`

## 主要文件

- `src/App.vue`：资产运营驾驶舱、业务对象切换与 iframe 助手宿主。
- `src/main.ts`：Vue 与 Element Plus 应用入口。
- `src/styles.css`：Product B 独立的深色资产运营视觉系统。
- `vite.config.ts`：Web 端口及 Agent API 代理。
- `tests/`：iframe 问答与资产上下文切换 E2E。

## 运行与验证

推荐从仓库根目录执行 `pnpm demo` 启动完整双产品演示。单包验证：

```bash
pnpm --filter @assistant/demo-product-b-web build
pnpm --filter @assistant/demo-product-b-web typecheck
pnpm --filter @assistant/demo-product-b-web e2e
```
