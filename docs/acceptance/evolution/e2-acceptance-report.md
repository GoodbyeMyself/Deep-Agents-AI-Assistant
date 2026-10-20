# E2 · Plugin Bundle V2 与事务式装载验收

## 阶段结论

- 阶段：E2
- 日期：2026-10-20
- 结果：通过
- 范围：Manifest V2、可信 Local Bundle 自带 Contract、部署批准策略及 Contract/Provider 事务回滚；不进入 Skill 内容加载和 Agent 装配。

## 已实现内容

### Manifest V2 与 SDK

- `pluginManifestSchema` 同时解析 V1/V2；V1 Local/HTTP 协议保持兼容。
- V2 固定 `apiVersion=2`、Local Runtime，并声明私有 `namespace`、Contract 来源、权限、风险及可选 Skill 路径。
- Plugin SDK 的 `AssistantPlugin.contracts` 允许可信 Bundle 导出通用 `CapabilityContract`；现有 V1 插件可继续只导出 Provider。
- V2 Manifest、运行时 Contract、Provider 集合必须完全一致；权限或风险元数据不一致时在注册前失败。

### 批准策略与路径安全

- 部署显式提供 `approvedPluginIds`、`approvedNamespaces`、`approvedPermissions`；缺失批准时默认拒绝。
- V2 私有动态能力仅允许 `read`，必须使用批准命名空间；平台 Contract 引用必须匹配 Catalog 的来源、权限和风险。
- Local entry 与 Skill 目录必须是插件真实根目录内的相对路径；拒绝绝对路径、路径逃逸、符号链接和错误文件类型。
- Skill 路径在 E2 只验证并记录，Skill 内容仍视为不可信指令，E3 才会装配。

### 事务装载与诊断

- Catalog 和 Capability Registry 注册返回幂等回滚租约。
- Runtime 依次完成发现、Manifest/批准/产物校验、模块加载、Contract/Provider 检查、注册、初始化、健康检查和 ready。
- Provider 冲突、初始化异常或健康失败都会撤销本 Bundle 已注册的 Contract 与 Provider，并尽力执行 `dispose()`。
- 插件状态记录 Manifest 版本、命名空间、Contract 来源、权限、风险、Skill 声明、失败阶段和错误码；Agent Server 的插件状态 API 输出安全诊断字段，不输出 Skill 内容。

## 自动化验证

`pnpm test`：通过，共 19 项。

| 套件 | 结果 |
| --- | --- |
| E0 Manifest V1 / A-B 兼容回归 | 7/7 Pass |
| E1 动态 Catalog 与类型推导 | 6/6 Pass |
| E2 Bundle V2 集成与安全回归 | 6/6 Pass |

E2 测试覆盖：

- 安装全新 V2 Bundle 后自动注册 Contract、Provider 并生成可执行 Tool；
- 删除 Bundle 后以新进程状态重启，Contract 与 Provider 消失；
- Provider 冲突回滚已注册 Contract；
- 初始化失败同时回滚 Contract 和 Provider；
- 未批准命名空间、权限、非只读风险和逃逸 Skill 路径失败关闭；
- Manifest 与运行时 Contract 元数据不一致时注册前失败；
- 动态 Tool 权限不足时 Executor 返回 `FORBIDDEN`。

## 能力契约/安全/Context/Evidence

- Contract：同 `id + version` 不覆盖；Schema 由 Bundle 运行时导出并经过 Catalog Zod 校验。
- 安全：只有安装目录中的批准 Local Bundle 可以贡献动态 Contract；动态 import 仍是可信同进程代码，不宣称沙箱。
- 权限：Manifest 只能声明权限，部署先批准，调用时 Executor 仍按可信执行上下文复核。
- Context：未修改 ContextSnapshot、身份建立或 Run 固定快照机制。
- Evidence：V2 动态 Tool 仍返回并校验统一 `CapabilityResult/Evidence`；测试 Evidence 可追溯。

## Mock 与真实边界

- E2 测试 Bundle 和元数据查询 Provider 是临时目录中的真实动态 JavaScript 模块，但业务响应为内存 Mock。
- 未使用真实业务 API、企业 IdP、生产凭证或模型 Key；不表示生产集成已完成。
- 未实现上传、市场、热加载或不可信代码沙箱。

## 剩余问题

- Skill 内容发现、Tool 依赖关联、名称冲突和 Agent Skill Snapshot 属于 E3。
- 标准能力仍在 Core；独立标准契约包及 A/B 迁移属于 E4。
- Bundle 当前沿用入口产物哈希机制；正式发布签名、升级和运维流程属于 E5。

## 退出门禁

- 安装新 V2 Bundle 后 Catalog、Registry 和 Tool 自动变化：满足。
- 删除 Bundle 并重启后能力消失：满足。
- 失败插件不污染 Catalog/Registry：满足。
- Manifest V1 插件继续加载：满足。
- Lint、Typecheck、Build：全部通过后确认。

结论：E2 通过后停止，不自动进入 E3。
