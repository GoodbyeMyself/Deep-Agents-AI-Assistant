# Evidence

定义证据的持久化记录和对外解析结果，确保模型回答中的业务事实可以追溯到来源、范围、时间与方法。

## 主要能力

- 校验带 owner、tenant、run 和业务对象关联的 Evidence Record。
- 将内部记录转换为受控的 `ResolvedEvidence`。
- 复用标准 Capability 中的 Evidence Schema。

## 安全边界

证据引用不是永久访问凭证。读取 Evidence 时必须再次校验当前用户、租户和业务授权，不能仅凭 referenceId 返回数据。

## 验证

```bash
pnpm --filter @assistant/evidence build
pnpm --filter @assistant/evidence typecheck
pnpm --filter @assistant/evidence test
```
