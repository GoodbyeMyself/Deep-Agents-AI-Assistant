# Product A Web Demo

Product A 数据质量运营台。宿主采用 React 19 + Ant Design 6，界面按企业数据治理控制台设计；助手通过 iframe 接入，并把当前表、路由和业务域同步为标准 Host Context。

## 本地端口

- Web：`http://127.0.0.1:5411`
- Agent Server：`http://127.0.0.1:3411`
- iframe Assistant：`http://127.0.0.1:5511`

## 主要文件

- `src/main.tsx`：Product A 品牌、业务对象和页面指标配置。
- `../product-shell/`：React/Ant Design 控制台布局与安全 iframe 宿主实现。
- `vite.config.ts`：Web 端口及 Agent API 代理。
- `tests/`：iframe 问答与页面上下文切换 E2E。

## 运行与验证

推荐从仓库根目录执行 `pnpm demo` 启动完整双产品演示。单包验证：

```bash
pnpm --filter @assistant/demo-product-a-web build
pnpm --filter @assistant/demo-product-a-web typecheck
pnpm --filter @assistant/demo-product-a-web e2e
```
