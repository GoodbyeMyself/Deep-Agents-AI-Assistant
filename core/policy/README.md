# Policy

提供标准 Capability 的服务端授权策略实现。目前的企业策略同时检查能力权限、目标对象范围和 Context 中的当前对象。

## 授权规则

- 当前主体必须具备 Capability 要求的 permission scope。
- 带 `tableId` 的调用必须位于主体授权对象集合内。
- 页面上下文已经绑定对象时，调用目标必须与该对象一致。

## 边界

Policy 是平台侧的一道强制检查，但不能替代原业务 API 的最终行、列、字段和对象授权。模型是否决定调用工具不影响授权结果。

## 验证

```bash
pnpm --filter @assistant/policy build
pnpm --filter @assistant/policy typecheck
pnpm --filter @assistant/policy test
```
