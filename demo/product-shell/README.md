# Demo Product Shell

Product A 使用的 React/Ant Design 业务页面壳。它负责数据治理仪表盘布局、当前对象切换、模型状态展示和安全 iframe 助手挂载。Product B 已改用独立的 Vue 3 + Element Plus 页面，不依赖本包。

## 主要导出

- `DemoProductShell`：Product A 的 React/Ant Design 页面壳。
- `DemoProductConfig`：品牌、导航、业务对象、指标和 iframe Origin 配置。
- `styles.css`：Product A 控制台样式。

## iframe 接入

页面通过 `AssistantApiTransport` 创建一次性票据，再用 `iframe-bridge` 传递票据和 `RawHostContext`。业务对象切换会更新 Bridge 上下文，但正在执行的 Run 仍使用创建时的 ContextSnapshot。

## 边界

本包仅服务演示页面，不应被正式 Core、Runtime 或 Server 反向依赖。

## 验证

```bash
pnpm --filter @assistant/demo-product-shell build
pnpm --filter @assistant/demo-product-shell typecheck
```
