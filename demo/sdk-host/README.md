# SDK Host Demo

轻量接入实验宿主，用于在最小业务页中验证 **React SDK（内联 panel）** 与 Shared Chat Core、Agent Server 的联调。

本目录**不包含**原生 JavaScript SDK（`createAssistant`）或跨 Origin iframe（Loader / 票据）的对比页；后者见 `demo/product-a`、`demo/product-b` 与 `apps/assistant-embed`。

## 当前实现

- `src/main.tsx`：`AssistantController` + `AssistantProvider` + `AssistantSurface`，`presentation: "inline"`。
- 固定 Mock `RawHostContext` 与 `getAccessCredential`（`mock-token-admin`），无业务台 UI、无宿主对象切换演示。

## 运行

```bash
pnpm --filter @assistant/demo-host dev
# 或仓库根目录：pnpm dev:sdk-host

pnpm --filter @assistant/demo-host build
pnpm --filter @assistant/demo-host typecheck
```

本地开发需已启动 Agent Server（与独立 Web / 嵌入演示相同的后端约定）。

## 边界

集成验证用薄宿主，**不是** Product A/B 的推荐演示入口；完整 iframe 接入与 Host Context 同步请使用 `pnpm demo` 打开的双产品演示。
