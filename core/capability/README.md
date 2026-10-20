# Capability Core

包名：`@assistant/capability-core`。这里只保留稳定的通用内核：Capability/Result/Evidence 契约、Catalog、Registry、Executor、Policy 与 Audit 接口，不包含任何具体业务能力 ID 或 Schema。

具体标准能力由独立版本化包提供：

- `@assistant/capability-data-map`
- `@assistant/capability-data-quality`

应用 Composition Root 显式把标准能力包注册到 Catalog；Adapter 直接依赖所实现的领域能力包。新增标准能力不应修改 Core、Agent Runtime、Tool Factory 或 UI。

旧包名 `@assistant/capability-contracts` 已移动到 `packages/capability-contracts`，仅作为过渡兼容聚合层。兼容层保留至 E5 完成后的首个发布周期，最早只会在下一次 breaking release 移除；新代码不得继续依赖它。

## 依赖边界

本包不依赖标准能力包、产品 Adapter、Deep Agents、HTTP Server 或 UI。标准能力包可以依赖本包，反向依赖禁止。
