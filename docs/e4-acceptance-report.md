# E4 · 标准能力包拆分与现有 Adapter 迁移验收

- 日期：2026-10-20
- 阶段：E4
- 范围：标准能力包拆分、A/B Adapter 迁移、元数据查询契约、安全过滤、兼容层与共享契约测试；不进入 E5 发布流程。

## 已实现

- `@assistant/capability-core` 不再导出具体业务能力。
- 新增 `@assistant/capability-data-map`、`@assistant/capability-data-quality` 两个版本化标准包。
- 新增独立的旧包名 `@assistant/capability-contracts` 兼容聚合层。
- 原有 `data_map.search_objects@1.0.0`、`data_quality.get_trend@1.0.0` 保持 ID、版本和 Schema 语义。
- 新增 `data_map.get_object_metadata@1.0.0`，A/B 使用不同原始字段映射到相同标准输出。
- 每个标准能力包包含共享 Provider 契约套件，A/B 均执行同一套验证。

## 安全与契约验证

- Executor 继续执行能力级权限；Adapter/模拟业务边界执行对象级和字段级授权。
- 无权对象返回 `FORBIDDEN`；未绑定 Provider 返回 `UNSUPPORTED`。
- 无敏感字段权限时，受限字段在 Provider 返回前移除；结果为 `partial` 并附泛化 warning 与 Evidence，不泄露受限字段名称或值。
- 有额外字段权限时才返回 `restricted` 字段元数据。
- 同 `id + version` 重复契约拒绝覆盖；质量单位不是 `percent` 时稳定归一为 `SCHEMA_MISMATCH`。

## 兼容、迁移与回滚

- 旧导入 `@assistant/capability-contracts` 暂由兼容包继续支持；新代码必须改用 `@assistant/capability-core` 或具体领域能力包。
- 兼容层保留至 E5 完成后的首个发布周期，最早在下一次 breaking release 移除。
- 回滚时可让 A/B Adapter 临时恢复旧兼容包导入，并让 Agent Server 恢复 `createStandardCapabilityCatalog()`；能力 ID 与版本不变，无数据迁移。

## 测试记录

- `pnpm install`：由用户手动执行；锁文件只更新 workspace 链接，无新增第三方版本。
- `pnpm test:e4`：由用户手动执行；9 个相关包构建成功，6/6 测试通过。
- `pnpm test`：由用户手动执行；首次因 E0 仍从 Core 导入兼容工厂而失败，修正为从兼容包导入并将其加入 E0 构建依赖后，E0～E4 共 30 项测试全部通过（E0 7、E1 6、E2 6、E3 5、E4 6）。
- `pnpm lint`：由用户手动执行；首次因 `@assistant/policy` 的旧 `dist/index.d.ts` 仍引用迁移前包名而失败。用户执行 `pnpm --filter @assistant/policy build` 后重跑通过，无错误或警告。
- `pnpm typecheck`：由用户手动执行，通过。
- `pnpm build`：由用户手动执行，通过。

## 真实与 Mock 边界

真实验证了 TypeScript 包构建、Plugin Runtime 装载、Catalog/Registry/Executor、标准 Schema 和共享契约套件。A/B 上游数据、授权引用和 Evidence 来源仍为 Mock；未声明真实企业元数据服务或字段权限系统已集成。

## 退出结论

E4 专项与完整仓库质量门禁均通过。E4 完成后停止，不自动进入 E5。
