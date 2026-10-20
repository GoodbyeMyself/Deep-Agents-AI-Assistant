# adapters

`adapters/` 存放具体产品的可信业务适配器源码。它把 Product A/B/C 不同的 API、字段、分页、
枚举和错误码，映射为 `domains/*` 定义的标准 Capability Contract；Agent、Tool Factory 和 UI
不应感知产品名称。

## 当前内容

| 目录 | 说明 |
| --- | --- |
| `demo-product-a/` | Product A 模拟业务 API 的 Adapter Plugin |
| `demo-product-b/` | Product B 模拟业务 API 的 Adapter Plugin |

两个目录用于证明不同原始数据可以输出相同标准语义，目前仍是 Mock 数据与授权引用，不代表真实
企业产品已经完成集成。

## 依赖边界

Adapter 可以依赖：

- `@assistant/plugin-sdk`：定义 Plugin 和实现 Capability；
- `@assistant/capability-core`：通用执行上下文与结果类型；
- `@assistant/capability-*`：`domains/*` 提供的标准业务契约。

Adapter 不得依赖 Agent Server、Agent Runtime、前端 UI，也不得调用 `createDeepAgent()`。产品差异
必须在 Adapter 内终结，不能通过产品名称分支泄漏到 Agent 或 UI。

## 安全要求

- 原业务 API 必须再次执行对象、行列、字段权限和脱敏，Prompt、Skill、页面 Context 不构成授权。
- 模型可见结果只能包含已授权字段，Evidence 引用不能携带密钥或敏感原文。
- Manifest 声明、Provider 实现和所引用 Contract 必须完全一致。
- 只有构建、审批、哈希和路径校验通过的产物才能进入部署插件目录。

## 新增 Adapter

1. 创建 `adapters/<adapter-id>/` workspace 包和 `plugin.json`。
2. 引用已有 `domains/*` 标准契约；不要复制同名 Schema。
3. 使用 `implementCapability()` 完成原始 API 到标准结果的映射。
4. 复用领域包的 Provider 契约测试，并增加产品授权与脱敏测试。
5. 通过仓库测试和发布审批后再安装到目标实例。

私有新能力优先使用 [Plugin Bundle V2 模板](../templates/plugin-bundle-v2/README.md)；确认需要跨产品
共享后，再按治理流程晋升为 `domains/*` 标准契约。

相关文档：[插件开发指南](../docs/plugin-development-guide.md)、
[插件系统设计](../docs/architecture-v2.0/05-插件系统与能力注册.md)。
