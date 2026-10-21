# CopilotKit 可选 Shell Spike 验收报告

日期：2026-10-21  
状态：通过工程阶段退出门禁

## 实现范围

- 新增隔离应用 `apps/copilotkit-shell-spike`，使用 CopilotKit v2 `CopilotChat` 作为可选 Shell，
  不修改 `assistant-ui`、现有 Shared Chat Core 或默认 Ant Design X Shell。
- 页面通过既有企业 REST 创建临时 Session 与不可变 ContextSnapshot，再将快照引用放入
  `forwardedProps.enterprise-assistant.contextSnapshotId`，由 `HttpAgent` 调用
  `POST /api/v1/ag-ui`。
- 使用 `agents__unsafe_dev_only` 做开发期本地 Agent 注册，不配置 CopilotKit Cloud/Runtime、
  license key、前端 Tool、interrupt resume 或多模态输入。
- Mock Bearer Token 仅存在于源码已有的本地演示身份映射和当前内存对象，不进入 URL、
  localStorage/sessionStorage、日志或 AG-UI `context/state`。
- 页面明确展示协议链路、当前 Session/Snapshot、Spike 边界和停止行为限制，并支持窄屏布局和
  reduced-motion 偏好。

## 兼容性结论

- 服务端与直接依赖锁定 `@ag-ui/client@1.0.3`，CopilotKit 1.79.1 自身内置
  `@ag-ui/client@1.0.2`；两者都声明 AG-UI 协议版本 `1.0`。
- 专项测试使用直接依赖的 `HttpAgent@1.0.3` 消费受治理端点，要求得到助手文本，并证明事实 Run
  绑定到当前用户的 Session 与 ContextSnapshot；同时静态断言 CopilotKit 1.79.1 的内置客户端
  版本。Spike 的 Vite build 负责验证实际 CopilotKit v2 前端入口与其内置客户端能够完成打包。
- 当前结论只覆盖 AG-UI 1.0 线级兼容，不承诺两个客户端包的 TypeScript 类型、内部状态实现或
  后续次版本始终兼容。升级 CopilotKit 或 AG-UI 时必须重复专项测试。

## 安全与企业边界

- Session 和 ContextSnapshot 仍由现有服务端创建并按用户、租户校验；CopilotKit 提供的
  `threadId/context/state` 不建立身份或权限。
- 客户端不注册 Tool；Capability Policy、原业务对象权限、Evidence 解引用和持久事件日志仍由
  既有企业链路负责。
- CopilotKit 的停止操作当前调用 `HttpAgent.abortRun()`，只会中止浏览器请求，不能证明服务端
  durable run 已取消。生产接入前必须设计受鉴权的 `cancelRun` 桥接，或在 UI 上禁用/重命名停止。
- `agents__unsafe_dev_only` 只允许用于本 Spike。生产采用自管理 Agent 时还需单独确认 CopilotKit
  授权、稳定 API、版本治理和安全审查，不能直接复制本配置。

## 测试与执行状态

- 直接 TypeScript 检查：通过（`tsc -p apps/copilotkit-shell-spike/tsconfig.json --noEmit`）。
- Spike 源码与测试 ESLint：通过。
- 直接 Node 专项测试：2/2 通过；真实覆盖 AG-UI `HttpAgent` 到受治理端点、助手消息回放、
  Session/ContextSnapshot 绑定和 CopilotKit 内置客户端版本锁定。
- Vite 生产构建：通过；主 JS 约 `2,036.77 kB`（gzip `586.36 kB`），并产生大量 Markdown、
  Mermaid、KaTeX 与代码高亮动态资源。该成本不影响隔离 Spike 结论，但在性能优化和预算验证前
  阻止其成为默认 Shell。
- `pnpm typecheck`：在允许读取完整 pnpm store 的环境中通过；该命令包含的全 workspace build
  以及随后单独复验的 25 个 workspace typecheck 均通过。受限沙箱内首次执行因第三方依赖文件
  `拒绝访问 (os error 5)` 中断，不是 TypeScript 错误或源码失败。
- `pnpm lint`：通过。首次失败是仓库根的外部参考源码目录 `源码 Deep agents/` 被根 ESLint
  扫描；该目录未被修改，现已同时加入 ESLint 与 Git ignore。
- 首次 Node 测试直接导入 CopilotKit UI 入口时确认该入口会加载 CSS，不适合 Node 原生测试；
  测试已按浏览器 bundle / 协议客户端职责拆分。
- `pnpm test:copilotkit-spike`：通过。
- `pnpm test`：通过，包含既有 E0～E5、AG-UI POC、双协议端点、标准命令入口与本 Spike 回归。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过；其前置 `pnpm build` 同时通过。

专项测试与全量回归由用户于 2026-10-21 在仓库根目录执行并确认；Lint 与 TypeScript/Build
结果由 Codex 同步复验。

## 退出条件

本 Spike 已通过工程阶段退出门禁。该结论证明 CopilotKit 可作为 AG-UI 1.0 兼容的隔离可选
Shell，不代表其已获准成为默认或生产 Shell；后续是否产品化需要单独决策取消语义、授权、升级
策略、bundle 性能、Evidence 展示和历史会话体验。
