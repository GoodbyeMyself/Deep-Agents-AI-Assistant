# Demo Product B Adapter

Product B 的可信本地 Adapter 样例。它演示不同产品原始模型如何实现与 Product A 相同的标准业务语义，例如把 `qualityRate: 0.96` 转换为标准百分比 `96`。

## 提供的能力

- `data_map.search_objects@1.0.0`
- `data_quality.get_trend@1.0.0`
- 对象级授权校验、缺失日期告警和 Evidence 生成

## 主要文件

- `plugin.json`：插件身份、入口和能力声明。
- `src/index.ts`：Product B 字段到标准契约的映射。
- `src/contract.test.ts`：与 Product A 共用的契约一致性测试。

## 边界

产品差异必须在 Adapter 内终结。Agent 核心只感知标准 Capability，不感知 Product B 身份。当前实现使用演示数据和 Mock 授权，生产接入时需替换为真实业务 API。

## 验证

```bash
pnpm --filter @assistant/demo-product-b build
pnpm --filter @assistant/demo-product-b typecheck
pnpm --filter @assistant/demo-product-b test
```
