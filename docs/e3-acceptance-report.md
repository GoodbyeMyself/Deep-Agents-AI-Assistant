# E3 · Plugin Skill 自动发现与 Tool 关联验收

## 阶段结论

- 阶段：E3
- 日期：2026-10-20
- 结果：通过
- 范围：Plugin Skill 可信发现、Capability/配置/凭证关联、同名冲突、Deep Agents 官方 Skills 装配与启动快照；不进入 E4 标准能力包迁移。

## 已实现内容

### Manifest 与可信发现

- Manifest V2 `skills` 兼容原路径字符串，并新增对象声明：`path`、`requiredCapabilities`、`requiredConfig`、`requiredCredentials`。
- 校验 Skill 位于插件真实根目录内；拒绝路径逃逸、任意层级符号链接、异常文件、单文件超过 512 KiB 或目录总量超过 2 MiB。
- 校验 Agent Skills frontmatter 的 `name`、`description`、目录名一致性及 `allowed-tools`，并记录整个 Skill 目录树的 SHA-256。

### Tool 关联、排除与冲突

- Skill 所需 Capability 必须由当前插件声明，或由部署以 `<pluginId>-><capabilityId>@<version>` 明确批准依赖。
- Runtime 在 Provider 注册后检查 Tool、配置和凭证存在性；任一条件不满足时 Skill 标记 `excluded`，记录稳定原因，但不伪装成可用，也不移除健康 Tool。
- 凭证只通过存在性回调检查，不获取密钥正文。无检查器等同不可用。
- Plugin Skill Registry 对可用 Skill 名称采用 `overridePolicy=deny`；冲突插件的 Contract、Provider、Skill 注册同步回滚。

### Agent 装配与快照

- Agent Server 将可用 Skill 复制到临时隔离工作区，路径固定为 `/skills/<name>/`；复制后重新计算目录树哈希，拒绝校验与复制之间发生的内容替换。
- Agent Runtime 直接使用 `deepagents@1.14.2` 的 `FilesystemBackend`、`skills` 和文件权限公开参数，不 Fork、不重写 Agent Loop。
- 快照只允许读取 `/skills/**`，拒绝写入及访问快照外文件。安装目录在 Agent 创建后变化不改变当前快照；插件变更要求重启。
- 运行时诊断可追溯 Skill 名称、插件 ID/版本、内容哈希、关联 Tool 和覆盖策略，不暴露 Skill 正文或凭据。

## 自动化验证

`pnpm test`：通过，共 24 项（E0 7、E1 6、E2 6、E3 5）。E3 新增回归覆盖：

1. 安装 Bundle 后 Contract、Provider、Tool 与关联 Skill 同时可用，并可被官方 Deep Agents Skill 解析器识别。
2. 安装目录中的 `SKILL.md` 在快照后变化，既有快照内容保持不变；校验后、复制前被替换的来源因哈希不一致而拒绝。
3. 缺 Tool、配置或凭证时 Skill 排除，健康 Tool 仍注册。
4. 插件健康失败时 Tool 回滚，Skill 以 `PLUGIN_UNAVAILABLE` 排除。
5. 同名 Skill 拒绝覆盖，冲突 Bundle 注册回滚。
6. `allowed-tools` 引用未关联 Tool 时在产物校验阶段拒绝。
7. 即使 Skill 存在，无权限主体调用 Tool 仍得到 `FORBIDDEN`。

## 能力契约/安全/Context/Evidence

- Capability Contract、Result Schema、Tool Factory 和 Executor 顺序未改变。
- Skill 只指导如何使用已批准 Tool；不改变身份、权限、对象范围、凭证引用或服务端 Policy。
- ContextSnapshot 与 Run 固定语义未改变；E3 增加的是 Agent 创建时 Tool/Skill 集合快照。
- Skill 内容不是业务事实或 Evidence；事实仍须来自受控 Tool，引用仍由服务端二次鉴权。

## Mock 与真实边界

- 回归使用真实临时插件目录、真实动态模块装载、真实 Deep Agents Skill 解析和内存 Mock Provider。
- 未使用真实模型 Key、企业 IdP、业务 API 或生产密钥管理系统；凭证门禁使用 Test Double，只验证存在性协议。
- 不包含插件市场、任意上传、热加载或不可信 JS 沙箱。

## 剩余问题

- 标准能力包拆分、A/B Adapter 迁移及首个标准元数据查询能力属于 E4。
- 发布签名、模板、安装升级回滚运维流程属于 E5。
- 临时快照在正常 Server `close` 时清理；进程被强制终止后由操作系统临时目录治理负责回收，生产部署应纳入运维清理策略。

## 退出门禁

- Tool 与关联 Skill 同时可用：满足。
- Tool 缺失或被禁用时 Skill 不可用：满足（Registry 无绑定即排除）。
- 权限不足时 Executor 稳定拒绝：满足。
- Tool/Skill 来源诊断可追溯：满足。
- 全量测试、Lint、Typecheck、Build：全部通过；Vite 仅报告既有的大 chunk 警告，不影响退出门禁。

结论：E3 完成后停止，不自动进入 E4。
