# Product A Web Demo

Product A 数据质量运营台。宿主采用 React 19 + Ant Design 6 + ProComponents（ProLayout / PageContainer）；助手通过 `index.html` 中的 loader 脚本 iframe 接入，并把当前表、路由和业务域同步为标准 Host Context。

## 本地端口

- Web：`http://127.0.0.1:5411`
- Agent Server：`http://127.0.0.1:3411`
- iframe Assistant：`http://127.0.0.1:5511`

## 主要文件

- `src/config.ts`：Product A 品牌、导航与业务对象配置。
- `src/App.tsx`：Ant Design Pro 布局与助手 Host Context 同步。
- `index.html`：企业助手 loader 与初始页面上下文 JSON。
- `vite.config.ts`：Web 端口及 Agent API 代理。
- `tests/`：iframe 问答与页面上下文切换 E2E。

## 运行与验证

推荐从仓库根目录执行 `pnpm demo` 启动完整双产品演示。单包验证：

```bash
pnpm --filter @assistant/demo-product-a-web build
pnpm --filter @assistant/demo-product-a-web typecheck
pnpm --filter @assistant/demo-product-a-web e2e
```
