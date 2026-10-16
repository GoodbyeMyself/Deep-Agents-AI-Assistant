# Context

定义宿主页面原始上下文、服务端归一化上下文、不可变 ContextSnapshot 和可信执行上下文。

## 核心对象

- `RawHostContext`：宿主可上报的页面、对象和业务语义。
- `NormalizedContext`：结合已认证主体后得到的服务端上下文。
- `ContextSnapshot`：Run 创建时固定的上下文快照。
- `VerifiedPrincipal`：由服务端身份系统建立的用户与授权范围。

## 安全边界

前端提交的用户、权限或 Prompt 均不可信。身份、权限范围和 `authorizationRef` 必须由服务端建立；页面切换只影响后续 Run。

## 验证

```bash
pnpm --filter @assistant/context build
pnpm --filter @assistant/context typecheck
pnpm --filter @assistant/context test
```
