# E0 · 插件化能力扩展决策与回归基线验收

- 日期：2026-10-19
- 阶段：E0
- 状态：通过
- 基线：架构 V2.0、当前 M0～M5 已实现代码

## 1. 目标与范围

E0 只完成决策固化和改造前回归基线，不实现动态 Capability Contract 注册，不修改 Manifest V1 协议，也不进入 E1。

本阶段目标：

1. 记录从封闭 Catalog 演进为可信动态契约注册的架构决定。
2. 明确标准能力、私有能力、命名空间、权限、风险和加载信任边界。
3. 为当前两项标准能力、A/B Adapter、Manifest V1、Tool Factory 和关键失败关闭行为建立可重复自动化基线。
4. 保证现有运行时行为和 Deep Agents 装配不变。

## 2. 已实现内容

### ADR-022

`docs/architecture-v2.0/18-架构决策记录.md` 新增 ADR-022，决定：

- Core 保留通用契约、结果、Context、Policy、Evidence、Audit 和执行规则；
- 标准能力由独立平台契约包提供，保留命名空间不可被插件覆盖；
- 私有能力使用批准的组织命名空间；
- 首版动态契约只接受可信本地、只读 Plugin Bundle；
- HTTP Provider 不允许远端临时定义 Tool Schema；
- Contract、Provider 和 Skill 后续采用 staging 校验和原子提交；
- Manifest V1 保留迁移期，不做热加载、插件市场或任意 JS 上传。

### 自动化回归入口

根 `package.json` 新增：

```text
pnpm test
pnpm test:e0
```

测试使用 Node 22 内置 `node:test`，没有新增 npm 测试依赖。`test:e0` 只构建测试需要的 Core、Plugin SDK/Runtime、Agent Runtime 和 A/B Adapter，不构建无关前端。

## 3. 回归矩阵

| 编号   | 场景                                                    | 结果 |
| ------ | ------------------------------------------------------- | ---- |
| E0-T01 | Catalog 固定两项标准能力                                | Pass |
| E0-T02 | A/B Manifest V1 声明相同能力                            | Pass |
| E0-T03 | A/B 插件启动进入 ready，Registry 与 Tool 名一致         | Pass |
| E0-T04 | A/B 标准业务数据语义等价，来源引用保持产品可追溯        | Pass |
| E0-T05 | 缺少 `data_quality:read` 时 Executor 在 Provider 前拒绝 | Pass |
| E0-T06 | 已安装但未批准插件不注册能力                            | Pass |
| E0-T07 | Manifest V1 声明未知契约时失败关闭                      | Pass |
| E0-T08 | Local entry 路径逃逸时失败关闭                          | Pass |

自动化文件：`tests/e0-regression/baseline.test.mjs`。其中部分场景在同一个 Node 子测试中同时验证，因此测试运行器报告 7 个子测试、8 项验收断言。

## 4. 真实命令与结果

```text
pnpm test
```

结果：7/7 子测试通过，0 failed。测试使用真实构建后的本地插件代码、真实 Plugin Runtime、Catalog、Registry、Executor 和 Tool Factory；业务数据、身份引用和 A/B 上游仍为现有 Mock。

阶段完成时还执行：

```text
pnpm lint
pnpm typecheck
pnpm build
```

最终结果：

- `pnpm test`：Pass，7/7 子测试通过；
- `pnpm lint`：Pass，0 error；
- `pnpm typecheck`：Pass，21/22 Workspace 项目按现有脚本完成构建与类型检查；
- `pnpm build`：Pass，21/22 Workspace 项目按现有脚本完成构建。

Vite 报告多个既有前端 Bundle 大于 500 kB；这是非阻断性能警告，不改变 E0 退出结论，也不是本阶段引入的行为变化。

## 5. 契约、安全、Context 与 Evidence 验证

- 契约：A/B 仍实现 `data_map.search_objects@1.0.0` 和 `data_quality.get_trend@1.0.0`，标准数据语义一致。
- 权限：缺少所需 Scope 时返回 `FORBIDDEN`，Audit outcome 为 `denied`。
- 插件信任：未批准插件、未知契约和路径逃逸均不产生 Registry Binding。
- Context：回归输入使用固定 `contextSnapshotId`、主体和对象范围；E0 未改变 Snapshot 实现。
- Evidence：A/B 返回不同产品来源的 `referenceId/sourceRef`，结果中不包含 `authorizationRef`。
- Tool：两个部署生成相同稳定 Tool 名 `data_map_search_objects` 与 `data_quality_get_trend`。

## 6. Mock 与未验证边界

- A/B 业务数据和 `mock-auth:*` 身份引用仍为 Mock。
- 未调用真实模型、企业 IdP、真实业务 API、持久化 Repository 或生产密钥系统。
- 动态 Catalog、Manifest V2、插件 Skill 自动加载、标准能力包拆分尚未实现，分别属于 E1～E4。
- E0 的通过不表示生产插件生态或任意第三方代码安全。

## 7. 变更文件

- `package.json`
- `tests/e0-regression/baseline.test.mjs`
- `docs/插件化能力扩展实施计划.md`
- `docs/architecture-v2.0/18-架构决策记录.md`
- `docs/implementation-status.md`
- `docs/acceptance/evolution/e0-acceptance-report.md`

## 8. 退出条件

- ADR-022 已接受：满足。
- 当前 Manifest V1、A/B Adapter 和 Tool 基线可重复执行：满足。
- 动态契约信任边界、命名空间和兼容策略无阶段阻断项：满足。
- 质量门禁：`test/lint/typecheck/build` 全部通过。

结论：E0 通过后停止，不自动进入 E1。
