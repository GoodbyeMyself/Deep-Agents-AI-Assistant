# Capability Contracts

平台标准业务能力的单一事实来源，包含契约、Catalog、Registry、Executor、Policy 接口和审计结构。

## 当前标准能力

- `data_map.search_objects@1.0.0`
- `data_quality.get_trend@1.0.0`

## 主要模块

- `contracts.ts`：Zod 输入、输出、Evidence、错误和警告结构。
- `catalog.ts`：标准能力目录。
- `registry.ts`：Capability Provider 注册与绑定。
- `executor.ts`：输入输出校验、Policy 执行和审计。

## 依赖边界

本包属于核心领域层，不依赖具体产品 Adapter、Deep Agents、HTTP Server 或 UI。新增能力应先在这里定义稳定语义与测试，再由插件实现。

## 验证

```bash
pnpm --filter @assistant/capability-contracts build
pnpm --filter @assistant/capability-contracts typecheck
pnpm --filter @assistant/capability-contracts test
```
