# Plugin Bundle V2 开发与发布指南

## 1. 适用范围

本指南用于给当前企业业务智能体实例增加可信本地只读能力。Plugin Bundle 可以携带私有
Capability Contract、Provider 与 Skill，也可以实现平台标准契约。它不是在线插件市场：
不接受用户上传、不远程下载、不热加载，变更均在实例停止接收新 Run 后安装并重启生效。

Skill 只提供工作方法，不能授予权限。Provider 访问业务数据时，原业务 API 仍必须执行对象、
行列、字段授权与脱敏；Capability Executor 会再次校验权限和输出 Schema。Evidence 引用在展示
时还要按当前主体二次鉴权。

## 2. 从模板创建

在仓库根目录运行：

```powershell
node deploy/plugin-release.mjs scaffold adapters/orders-metadata orders-metadata acme
```

生成包包含：

```text
adapters/orders-metadata/
├─ plugin.json
├─ plugin-release.json
├─ package.json
├─ src/index.ts
├─ skills/orders-metadata-lookup/SKILL.md
├─ tests/contract.test.mjs
└─ README.md
```

私有能力使用批准的 `<organization>.<domain>.<action>` 命名空间。标准能力必须依赖对应平台契约
包，Manifest 的 `contractSource` 指向平台包，不能复制或覆盖同名 Schema。

## 3. 开发门禁

Provider 必须：

- 只接收契约白名单字段，身份、租户和凭证来自服务端执行上下文；
- 在原业务 API 层再次执行对象、行列和字段授权；
- 先过滤敏感字段，再构造模型可见结果；
- 返回满足统一 Schema 的 `status/data/evidence/warnings/error`；
- 使用不可包含密钥或敏感原文的 Evidence `referenceId`；
- 对上游超时、无权、部分数据和不支持能力使用标准错误/partial 语义。

Skill 的 `allowed-tools` 必须与 Manifest 的 `requiredCapabilities` 一致。缺 Tool、配置或凭证时，
Skill 会被排除，但不会改变权限决策。

## 4. 构建、哈希与批准

先在插件包完成构建和测试。然后对独立发布目录写入入口 SHA-256：

```powershell
node deploy/plugin-release.mjs hash <bundle-dir>
```

部署负责人核对代码审查、测试、来源和哈希后，在实例外保存批准文件：

```json
{
  "pluginId": "orders-metadata",
  "namespace": "acme",
  "artifactHash": "sha256-...",
  "permissions": ["metadata:read"],
  "configVersion": 1,
  "allowBreakingUpgrade": false
}
```

批准文件不放模型密钥、业务 Token 或配置值。验证命令：

```powershell
node deploy/plugin-release.mjs verify <bundle-dir> <approval.json>
```

## 5. 安装、升级、禁用与回滚

`<deployment-dir>/active` 是 `PLUGINS_DIR`；`releases` 保存已验证版本；`state` 保存非敏感发布记录。
安装或升级：

```powershell
node deploy/plugin-release.mjs install <bundle-dir> <deployment-dir> <approval.json>
```

升级默认必须保留旧的 `capabilityId@contractVersion`。确需 breaking 变更时，Bundle 的
`plugin-release.json` 与批准文件必须双向显式允许，并按新旧契约并行/迁移计划单独评审。

`plugin-release.json` 的 `compatibleConfigVersions` 只做兼容门禁。配置迁移由受审查的实例运维
步骤在安装前产生新配置快照，完成校验后把其版本写入批准文件；发布工具不执行 Bundle 中的
任意迁移脚本，不读取或复制密钥。门禁失败时 active 版本不变。

禁用会从 active 中移除可发现副本，但保留 release 和 state，可恢复：

```powershell
node deploy/plugin-release.mjs disable <deployment-dir> <plugin-id>
```

升级回滚到上一已验证版本：

```powershell
node deploy/plugin-release.mjs rollback <deployment-dir> <plugin-id>
```

上述操作均要求先停止接收新 Run，完成后重启 Agent Server；不支持热切换当前 Agent/Run。

## 6. 诊断

```powershell
node deploy/plugin-release.mjs diagnose <deployment-dir> <plugin-id>
```

诊断只输出版本、入口哈希、配置版本、active 状态和发布时间，不输出 Prompt、密钥或业务原始
响应。实例启动后还要检查管理员插件状态：必须为 `ready`，Contract 来源、权限、风险、Skill
来源与批准记录一致。

## 7. 验收与回滚检查单

1. 运行插件包测试与仓库 `test:e0`～`test:e5`、lint、typecheck、build。
2. 用无权主体验证 `FORBIDDEN`，用越界对象验证业务 API 拒绝。
3. 篡改入口后验证 `INTEGRITY_MISMATCH`/发布验证失败。
4. 验证 Schema/Evidence 不合格返回 `SCHEMA_MISMATCH`，不会进入模型上下文。
5. 验证 A/B 实例的批准列表、安装目录、配置、凭证和状态彼此独立。
6. 保存当前与上一版本哈希、配置快照版本和诊断结果，再切流量。

当前仓库的 A/B 数据、身份与发布验收仍为 Mock/临时目录。生产试点还必须单独接入企业 IdP、
真实业务 API、持久化 Repository、官方持久化 Checkpointer、密钥管理和监控告警。
