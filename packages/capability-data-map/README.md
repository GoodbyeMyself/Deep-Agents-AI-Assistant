# Data Map Capability Contracts

版本化的平台数据地图标准契约包：`@assistant/capability-data-map`。

包含：

- `data_map.search_objects@1.0.0`
- `data_map.get_object_metadata@1.0.0`

元数据契约只返回已授权对象与字段描述，不返回字段值。字段被对象级或字段级权限过滤时，Adapter 必须在进入模型上下文前移除数据；部分可见时返回 `partial`、明确 warning 和可追溯 Evidence。

`contract-tests/provider-suite.mjs` 是所有实现该领域能力的 Adapter 共用的 Provider 契约套件。
