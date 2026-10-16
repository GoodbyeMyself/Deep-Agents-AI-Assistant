# Capability Contract Testkit

业务 Adapter 共用的标准契约测试套件，用于证明不同产品实现具有相同输入输出语义。

## 当前检查

- 插件准确声明两个 MVP 标准能力。
- 产品对象字段映射为标准数据地图对象。
- 质量分数统一为百分比和日聚合。
- 缺失日期返回 `partial` 与明确警告，不补造数据点。

## 使用方式

Adapter 测试导入 `runStandardCapabilityContractSuite`，传入插件工厂即可复用完整断言。

## 构建与类型检查

```bash
pnpm --filter @assistant/capability-contract-testkit build
pnpm --filter @assistant/capability-contract-testkit typecheck
```
