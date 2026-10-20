# Deprecated Capability Compatibility Layer

`@assistant/capability-contracts` 是 E4 迁移兼容层，聚合 `@assistant/capability-core`、`@assistant/capability-data-map` 和 `@assistant/capability-data-quality` 的旧导出，并保留 `createStandardCapabilityCatalog()`。

新代码应直接依赖 Core 或具体领域能力包。兼容层保留至 E5 完成后的首个发布周期，最早只会在下一次 breaking release 移除。
