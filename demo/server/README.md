# Demo Server

演示场景使用的 Agent Server 启动入口，复用正式 `apps/agent-server`，并为不同阶段和产品装配模型与批准插件。

## 入口

- `demo-product-a-server-main.ts`、`demo-product-b-server-main.ts`：真实 DeepSeek A/B 演示。
- `demo-product-a-e2e-server-main.ts`、`demo-product-b-e2e-server-main.ts`：仅供 Playwright 的固定 Test Double。
- `m3-demo-server-main.ts`、`m4-demo-server-main.ts`：历史阶段回归入口。
- `demo-product-server.ts`：A/B 共用服务装配。

## 模型边界

交互式 A/B 演示必须配置根目录 `.env` 中的 `DEEPSEEK_API_KEY`，缺少时直接启动失败。Test Double 只存在于独立 E2E 入口，不是用户可选的演示模式。

## 运行与验证

```bash
pnpm --filter @assistant/demo-server serve:product-a
pnpm --filter @assistant/demo-server serve:product-b
pnpm --filter @assistant/demo-server typecheck
```
