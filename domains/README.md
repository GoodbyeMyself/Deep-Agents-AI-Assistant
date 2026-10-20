# domains

`domains/` 存放跨产品复用的标准业务语义，是标准 Capability Contract 的单一事实来源。它描述
“业务能力是什么”，不描述某个产品“如何调用 API 实现它”。

## 当前领域

| 目录 | npm 包 | 标准能力 |
| --- | --- | --- |
| `data-map/` | `@assistant/capability-data-map` | `data_map.search_objects`、`data_map.get_object_metadata` |
| `data-quality/` | `@assistant/capability-data-quality` | `data_quality.get_trend` |

每个领域包维护版本化输入/输出 Schema、权限、风险、单位、错误/partial 语义和共享 Provider 契约
测试。不同 Adapter 引用同一个领域包，因此不能各自解释同名能力。

## 依赖边界

领域包可以依赖：

- `@assistant/capability-core` 的通用 Contract 和 Result；
- Zod 等纯 Schema 依赖。

领域包不得依赖 Adapter、Agent Runtime、Plugin Runtime、应用入口、UI 或具体产品 API。Provider
实现位于 `adapters/*` 或可信 Plugin Bundle；领域包自身不连接业务系统。

## 何时新增领域契约

满足以下条件时，才把能力加入 `domains/*`：

- 至少需要在多个产品或 Adapter 间保持同名、同义、同单位和同权限语义；
- 输入输出、Evidence 和 partial/error 规则已经稳定；
- 有共享契约测试可以约束所有 Provider；
- 已评审版本兼容、迁移和回滚策略。

客户或单一部署独有、仍在试验的能力应先随 Manifest V2 Plugin Bundle 发布，使用批准的私有
命名空间；不要为了一个私有能力创建空领域包。

## 新增领域

1. 创建 `domains/<domain>/` workspace 包，包名使用 `@assistant/capability-<domain>`。
2. 只定义 Contract、Schema、来源元数据、类型和 Provider 契约测试。
3. 在 Composition Root 注册平台标准来源。
4. 让每个声明支持该能力的 Adapter 通过同一组测试。
5. 对新增保留命名空间或不兼容版本记录 ADR。

相关文档：[工程结构与依赖规则](../docs/architecture-v2.0/03-工程结构与依赖规则.md)、
[插件化能力扩展计划](../docs/插件化能力扩展实施计划.md)。
