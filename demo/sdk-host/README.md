# SDK Host Demo

接入实验宿主，在同一业务场景中验证 React SDK、Vanilla JavaScript SDK 和跨 Origin iframe 三种接入方式。

## 验证内容

- 三种接入方式复用同一个 Chat Core 和 Agent Server。
- 宿主对象从订单切换到客户时更新后续请求上下文。
- iframe 票据交换、Origin 校验和无凭证 URL。
- SDK 的 mount、open、close、updateContext 和 destroy 生命周期。

## 运行与验证

```bash
pnpm --filter @assistant/demo-host dev
pnpm --filter @assistant/demo-host build
pnpm --filter @assistant/demo-host typecheck
pnpm --filter @assistant/demo-host e2e
```

此目录是集成验证工程，不是产品 A/B 的推荐演示入口。
