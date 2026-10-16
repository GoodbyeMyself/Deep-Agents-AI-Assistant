# Product B Web Demo

Product B 数据资产驾驶舱。宿主采用 Vue 3 + Element Plus + **Art Design Pro 风格布局**（侧栏菜单 + 顶栏面包屑 + 卡片化内容区）；助手通过 `index.html` 中的 loader 脚本 iframe 接入，用于验证不同前端框架、产品术语与 Adapter 仍可复用相同助手契约。

## 本地端口

- Web：`http://127.0.0.1:5412`
- Agent Server：`http://127.0.0.1:3412`
- iframe Assistant：`http://127.0.0.1:5512`

## 主要文件

- `src/config.ts`：Product B 品牌、导航与资产业务对象配置。
- `src/App.vue`：Art Design Pro 风格壳层、资产切换与 Host Context 同步。
- `index.html`：企业助手 loader 与初始页面上下文 JSON。
- `vite.config.ts`：Web 端口及 Agent API 代理。
- `tests/`：iframe 问答与资产上下文切换 E2E。

## 运行与验证

推荐从仓库根目录执行 `pnpm demo` 启动完整双产品演示。单包验证：

```bash
pnpm --filter @assistant/demo-product-b-web build
pnpm --filter @assistant/demo-product-b-web typecheck
pnpm --filter @assistant/demo-product-b-web e2e
```
