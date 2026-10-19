# Capability Contracts

平台标准业务能力的单一事实来源，包含契约、Catalog、Registry、Executor、Policy 接口和审计结构。

## 当前标准能力

- `data_map.search_objects@1.0.0`
- `data_quality.get_trend@1.0.0`

## 目录结构（`src/`）

```text
src/
├── index.ts                 # 包公共导出（@assistant/capability-contracts）
├── contracts/               # Zod 契约与标准能力定义
│   ├── common.ts              # Evidence、错误、Result 工厂、CapabilityContract
│   ├── standard/              # 各标准能力契约（一能力一文件）
│   │   ├── data-map-search-objects.ts
│   │   ├── quality-trend.ts
│   │   └── index.ts           # standardCapabilityContracts 聚合
│   └── index.ts               # 包内 contracts 公共入口
├── catalog/                   # 标准能力目录
│   └── catalog.ts
├── registry/                  # Provider 绑定注册
│   └── registry.ts
└── executor/                  # 校验、Policy、审计与执行
    ├── policy.ts
    ├── executor.ts
    └── index.ts
```

新增标准能力时：在 `contracts/standard/` 增加独立文件并在 `contracts/standard/index.ts` 注册到 `standardCapabilityContracts`。

## 依赖边界

本包属于核心领域层，不依赖具体产品 Adapter、Deep Agents、HTTP Server 或 UI。新增能力应先在这里定义稳定语义与测试，再由插件实现。

## 验证

```bash
pnpm --filter @assistant/capability-contracts build
pnpm --filter @assistant/capability-contracts typecheck
pnpm --filter @assistant/capability-contracts test
```
