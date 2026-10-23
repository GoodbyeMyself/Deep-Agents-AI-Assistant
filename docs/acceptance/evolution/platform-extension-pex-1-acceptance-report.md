# PEX-1 · 受治理的平台扩展最小闭环验收报告

- 日期：2026-10-23
- 状态：通过工程阶段退出门禁；用户 `pnpm install`、标准 `pnpm test:platform-extensions`、
  `pnpm test:ag-ui-hitl`、`pnpm lint`、全量 `pnpm test` 与 `pnpm typecheck`（包含全量 build）均已通过
- 决策：ADR-028

## 目标与范围

在不恢复旧业务 Plugin Runtime、不修改 Deep Agents Agent Loop、不改变一系统一 MCP 的前提下，验证
Platform Extension 可以贡献只读平台 Tool 和受审核 Skill。

本阶段不包含第三方市场、运行时上传、热加载、任意 Middleware、UI JavaScript 注入、写 Tool 或平台
Provider SPI。

## 代码变更

- `packages/platform-extension-runtime`：Manifest、Approval Snapshot、Loader、Tool Factory、Skill Snapshot。
- `extensions/platform-diagnostics`：独立目录中的纯平台参考 Tool 与 Skill。
- `apps/agent-server/src/composition/*`、`server-main.ts`：运行时装配入口。
- `tests/platform-extensions/platform-extension-runtime.test.mjs`：专项回归。

## 安全验证目标

- 只接受部署批准的已安装包名，拒绝路径和 URL 模块来源。
- Extension ID、版本和 Manifest 摘要漂移时失败关闭。
- Platform Tool 声明和实现必须完全一致，首版风险固定为只读。
- Tool 权限只从可信 Runtime Context 获取；缺少权限时失败关闭。
- Skill 必须位于扩展根目录，拒绝符号链接、内容漂移和超限文件。
- Skill Snapshot 只允许读取 `/skills/**`，拒绝其他读取和全部写入。
- 参考扩展不得定义业务 Tool、业务 Schema、业务权限或产品 API。

## 建议用户执行的真实命令

```powershell
pnpm install
pnpm test:platform-extensions
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

根据仓库纪律，上述命令未由 Codex 执行。只有用户提供真实输出后才能更新本报告为通过。

## Codex 本地诊断

- 使用仓库锁定的 TypeScript 编译器分别检查 Platform Extension Runtime、参考 Extension、Agent Server
  与 Assistant Web：通过。
- 使用现有锁定依赖和临时模块解析器直接执行
  `tests/platform-extensions/platform-extension-runtime.test.mjs`：8/8 通过。
- 定向 ESLint 在新增 workspace 依赖尚未由 `pnpm install` 建立链接时曾产生模块无法解析的级联错误；
  已修复其中可独立确认的 `require-await`、类型导入和 unknown 数组收窄问题。依赖安装后，Codex 直接
  调用 ESLint 底层入口验证全仓 0 error、0 warning；该诊断不替代下述用户标准命令结果。
- 上述临时检查配置和解析器已删除，未进入交付文件。

## 用户真实执行记录

- 2026-10-23：`pnpm install` 成功，Scope 为全部 16 个 workspace projects；resolved 868、reused 817、
  downloaded 0、added 0，耗时 15.8 秒，pnpm 版本 10.32.1。
- npm registry 慢请求和 `hast@1.0.0` deprecated 为 warning，没有导致安装失败。
- `pnpm-lock.yaml` 已生成新增 Runtime、参考 Extension 和 Agent Server 依赖关系。
- 2026-10-23：`pnpm test:platform-extensions` 成功。`platform-extension-runtime` 与
  `platform-diagnostics-extension` 构建成功；专项测试 tests 8、pass 8、fail 0、cancelled 0、skipped 0、
  todo 0，测试时长约 710 ms。
- 2026-10-23：首次 `pnpm lint` 发现 9 个 `no-undef`，均来自既有 Node `.mjs` 测试的 `process` 和
  `AbortController` 环境声明缺失。统一修正 `eslint.config.js` 的测试 globals，并移除 4 个冗余文件级
  global 注释后，用户重跑 `pnpm lint` 确认通过。
- 2026-10-23：参考 Extension 从 `packages/platform-diagnostics-extension` 迁移到独立目录
  `extensions/platform-diagnostics`。Codex 直接执行 ESLint、Extension TypeScript `--noEmit` 与 Node
  专项测试，结果均通过，专项测试 8/8；迁移后的 workspace 链接和标准命令仍待用户复验。
- 2026-10-23：用户全量测试运行至 AG-UI HITL 时有 2 项失败。根因为测试假 Agent 在恢复后返回空流，
  被现有可信答案校验按 `ANSWER_EMPTY` 正确拒绝；修正夹具使其输出合法 `AIMessage`，不改变生产恢复
  逻辑或安全策略。Codex 直接复验 HITL 2/2 通过。
- 2026-10-23：用户在修复后重新执行 `pnpm install`、`pnpm test:ag-ui-hitl` 与全量 `pnpm test`，确认
  三条命令全部通过；迁移后的 workspace 链接和 HITL/全量回归已完成真实复验。
- 2026-10-23：用户执行 `pnpm typecheck` 并确认通过。根脚本包含前置全量 `pnpm build`，因此全量
  build 和各 workspace typecheck 均已完成真实验证。

## Exit Criteria

当前结论：**通过**。安装、平台扩展专项测试、HITL、lint、全量 test、build 与 typecheck 均已由用户
执行并确认成功。该结论表示 PEX-1 本地工程门禁通过，不等同于未经部署审批的生产扩展上线批准。
