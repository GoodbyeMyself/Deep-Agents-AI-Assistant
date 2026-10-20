# E1 · 开放 Capability SDK 与动态 Catalog 验收

## 阶段结论

- 阶段：E1
- 日期：2026-10-19
- 结果：通过
- 范围：开放通用能力定义与受控动态 Catalog，不开放 Plugin Bundle 自带契约安装。

## 已实现内容

### 通用 Capability SDK

- Core 公开 `defineCapability()`，由输入与数据 Zod Schema 推导具体 TypeScript 类型，并统一包装 `CapabilityResult` 输出 Schema。
- Plugin SDK 重新导出 `defineCapability()`；`implementCapability()` 从固定 `KnownCapabilityContract` 联合类型改为通用 `CapabilityContract` 泛型。
- 保留 `KnownCapabilityContract` 和 `standardCapabilityContracts` 导出，兼容既有标准能力及 Manifest V1 路径，但它们不再是新能力的类型门禁。

### 受控动态 Catalog

- `CapabilityCatalog` 支持 `register()`、`registerMany()`、来源查询与注册清单查询。
- `registerMany()` 在 staging Map 中完成全部校验后一次提交；同批或现有 Catalog 出现相同 `id + version` 时失败关闭，不留下部分注册。
- 注册校验覆盖能力 ID、SemVer、描述、Zod 输入/输出 Schema、权限名、风险等级及来源元数据。
- 私有插件契约必须使用来源批准的三段式命名空间，不得占用 `data_map`、`data_quality` 平台保留空间；E1 动态私有契约仅允许 `read` 风险。
- 标准契约仍由平台来源在 Catalog 构造时注册，A/B 现有装配无须改动。

### Tool Factory 与执行链

- Tool Factory 仍只依赖 Catalog、Registry 和 Executor，不包含具体能力 ID 分支。
- 未在 Catalog 注册的 Provider 无法形成 Tool；不同能力 ID 归一化成相同 Tool 名时给出稳定冲突诊断。
- 动态能力执行仍经过 Capability Executor 的输入、权限、输出与 Evidence 校验，没有建立绕过路径。

## 自动化验证

### E1 专项测试

`pnpm test:e1`：通过，6/6。

| 编号 | 验证项 | 结果 |
| --- | --- | --- |
| E1-T01 | 编译期未知契约可注册、生成 Tool 并执行，类型探针保持输入推导 | Pass |
| E1-T02 | 相同 `id + version`、不同 Schema 冲突且批量注册原子回滚 | Pass |
| E1-T03 | 非法来源、命名空间、保留空间及非只读风险被拒绝 | Pass |
| E1-T04 | 非法权限名和非 Zod Schema 被拒绝 | Pass |
| E1-T05 | 只有 Provider、没有契约时 Tool Factory 失败关闭 | Pass |
| E1-T06 | Tool 名归一化冲突可稳定诊断 | Pass |

编译期探针使用 `@ts-expect-error` 验证动态能力输入没有退化为 `any`，并由 Plugin SDK 的 `typecheck` 执行。

### 仓库门禁

- `pnpm test`：通过；E0 兼容回归 7/7，E1 专项回归 6/6。
- `pnpm lint`：通过，0 error / 0 warning。
- `pnpm typecheck`：通过；命令包含一次完整构建及所有 workspace 类型检查。
- `pnpm build`：通过；Vite 仅报告既有的前端 chunk 大小警告。

## 能力契约与安全边界

- 契约：固定联合类型不再控制全部可扩展能力；标准能力的 ID、版本和 Schema 保持不变。
- 权限：插件只能声明权限要求，调用仍由服务端 Executor 根据可信执行上下文判定；E1 不增加授权来源。
- Context：未修改 `ContextSnapshot`、Run 固定快照或 A/B 上下文桥接。
- Evidence：动态能力继续返回统一 `CapabilityResult`，执行输出 Schema 和 Evidence 规则保持生效。
- 来源：E1 实现内核来源模型与校验，但尚未把 Plugin Loader 的批准目录、哈希和 Manifest 与动态契约注册接通。
- 风险：私有动态契约只允许 `read`；`write/high` 仍未开放。

## Mock 与真实验证边界

- E1 测试中的新元数据查询 Provider 是内存 Mock，只用于验证契约、注册、Tool 生成和执行链，不代表真实业务 API 集成成功。
- A/B 兼容性通过既有 E0 回归套件验证；没有使用真实模型 Key、外部 API 或生产身份系统。
- 没有加载未知插件代码，没有实现热加载、任意上传或插件市场。

## 与基线及 ADR 的关系

- 符合 ADR-022 的“稳定 Core + 可信动态契约”决策，并在 ADR 中补记 E1 的实际来源模型和限制。
- Manifest V1 保持不变；Manifest V2、Bundle 自带 Contract、跨 Contract/Provider 的事务装载属于 E2。
- 未修改或 Fork 官方 Deep Agents Agent Loop、LangGraph 状态运行机制。

## 剩余问题

- 动态 Catalog 尚未由 Plugin Loader 驱动，部署允许命名空间也尚未接入配置策略。
- Catalog 内部批量契约注册已经原子化，但 Contract、Provider、Plugin 状态的跨组件事务尚未实现。
- 标准能力仍位于 Core，待 E4 拆分为独立版本化契约包。
- 插件 Skill 的声明、关联与快照加载尚未实现，属于 E3。

## 退出门禁

- Core 不再通过固定联合类型决定所有可扩展能力：满足。
- 动态 Catalog、类型推导、冲突和失败关闭测试：满足。
- Manifest V1 与 A/B 行为兼容：由完整回归确认。
- 未越界进入 Plugin Bundle V2：满足。
- 仓库测试、Lint、Typecheck、Build：全部通过后满足。

结论：E1 通过后停止，不自动进入 E2。
