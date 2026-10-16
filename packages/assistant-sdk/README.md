# Assistant SDK

业务产品接入助手的 React 与 Vanilla JavaScript SDK，实现统一的 mount、open、close、updateContext、getState 和 destroy 生命周期。

## 主要导出

- `AssistantReact`、`AssistantProvider`、`AssistantSurface`、`useAssistant`
- `AssistantController`
- `createAssistant`
- `styles.css`

## 展示形态

支持 `floating`、`drawer` 和 `inline`。不同形态复用同一 Controller、Transport 和 Chat Core，不复制业务逻辑。

## 边界

SDK 接收宿主业务上下文和凭证获取函数，但不信任前端权限字段，也不直接感知 Deep Agents 或具体产品 Adapter。

## 验证

```bash
pnpm --filter @assistant/assistant-sdk build
pnpm --filter @assistant/assistant-sdk typecheck
pnpm --filter @assistant/assistant-sdk test
```
