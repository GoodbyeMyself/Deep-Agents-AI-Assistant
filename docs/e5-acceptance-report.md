# E5 系统验收、发布流程与文档收口报告

日期：2026-10-20  
状态：通过工程阶段退出门禁

## 实现范围

- 新增 Manifest V2 Plugin Bundle 模板，包含 Contract、Provider、Skill、README 与测试入口。
- 新增可信本地发布工具：入口哈希、批准校验、版本化安装、兼容升级、禁用、回滚和诊断。
- 发布工具校验插件 ID、命名空间、权限、入口哈希、配置版本和旧契约保留；失败不切换 active。
- 部署打包为每个 Adapter 发布副本写入入口完整性哈希，不修改 Adapter 源 Manifest。
- E5 回归覆盖模板生成、发布生命周期、A/B 独立插件集合及非法 Evidence 输出。
- E0～E4 已有回归继续承担路径逃逸、未知权限/高风险、重复 Tool、Skill/Tool 不一致、对象/字段
  授权和 Evidence 二次鉴权门禁；根 `pnpm test` 组合执行全部阶段。

## 真实与 Mock 边界

发布工具在临时本地目录执行真实文件复制、哈希验证、active 切换、禁用和回滚；Plugin Runtime
真实发现并装载发布后的 Bundle。A/B Provider、身份、业务数据与 Evidence Repository 仍为 Mock，
未连接生产 IdP、真实产品 API、持久化 Checkpointer、企业密钥库或监控平台。

## 已执行命令

- `pnpm test:e5`：通过（用户于 2026-10-20 在仓库根目录手动执行）
- `pnpm test`：通过，E0～E5 全量回归无异常（用户于 2026-10-20 手动执行）
- `pnpm lint`：首次因模板不是 workspace 成员、类型依赖不可解析而失败；排除未实例化模板并修正
  模板真实 lint 问题后复验通过。生成到 `adapters/` 后仍按 workspace 包执行 lint/typecheck。
- `pnpm typecheck`：通过（包含其脚本内部执行的 workspace build）
- `pnpm build`：通过

以上 pnpm 命令均由用户于 2026-10-20 在仓库根目录逐条手动执行并确认结果。

## 结论

E5 模板、发布生命周期、A/B 独立部署和安全回归已通过，满足当前工程阶段退出门禁。用户已确认
专项测试、全量回归、lint、typecheck 和 build 结果，可作为本阶段负责人验收记录。生产上线批准
不在本阶段范围，仍需负责人基于真实 IdP、业务 API、持久化、密钥与监控试点另行签署。
