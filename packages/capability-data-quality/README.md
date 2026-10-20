# Data Quality Capability Contracts

版本化的平台数据质量标准契约包：`@assistant/capability-data-quality`。

包含 `data_quality.get_trend@1.0.0`。标准单位固定为 `percent`，聚合固定为 `daily`；不支持或数据不完整时不得补造结果。

`contract-tests/provider-suite.mjs` 是所有实现该领域能力的 Adapter 共用的 Provider 契约套件。
