# AG-UI durable run 取消桥接验收报告

日期：2026-10-21  
状态：通过定向工程门禁

## 范围

- 将 `POST /api/v1/ag-ui` 响应流的提前取消映射到既有 `AgentRunner.cancel`。
- 让 Node HTTP 适配层把客户端断连传播为 Web Stream cancel。
- 保持 GET 事件重放流的断连语义不变。
- 验证取消目标和授权主体均由服务端事实建立，而不是取自 AG-UI 客户端字段。

## 实现与安全边界

`createAgUiRun` 同时返回内部 Run ID 与事件生成器，但内部 ID 只在 Agent Server 进程内用于取消，
不会写入公开 AG-UI 生命周期、metadata 或 HTTP 响应头。`eventStreamResponse` 仅对 AG-UI 命令入口
注册取消回调；回调闭包持有完成认证后的 principal，并继续复用 `AgentRunner.cancel` 内已有的
Run 所有者和租户校验。

客户端提交的 `threadId` 仍只用于查找已鉴权 Session，客户端 `runId` 只用于公开 AG-UI 生命周期
和幂等键，不用于选择取消目标。因此伪造另一个 Run ID 不能取消其他用户或同用户的其他运行。
普通 GET 事件流保持读取/重放职责，断开不会取消后台 Run。

## 验证结果

- `pnpm test:ag-ui-command`：通过，5/5。
- `pnpm test`：通过，E0～E5、AG-UI POC/端点/命令与 CopilotKit Spike 全部通过。
- `pnpm lint`：通过，0 error、0 warning。
- `pnpm typecheck`：通过；该命令包含全量 `pnpm build`，所有 workspace 构建和类型检查通过。
- 新增测试启动真实本地 Node HTTP Server，读取 `RUN_STARTED` 后中止客户端连接，并确认：
  - 服务端内部 Run 进入 `cancelled`；
  - 取消主体是建立该流的已认证用户；
  - 被取消的内部 Run ID 不等于客户端提供的 `client-cancel-run`。
- 定向构建随命令完成，Agent Server 及其 10 个依赖包均通过 TypeScript 构建。

`pnpm test` 和 `pnpm typecheck` 在受限沙箱内首次执行时，CopilotKit 的 Vite/Rolldown 构建读取
pnpm store 依赖文件遇到 Windows `os error 5`；在允许访问相同本地依赖目录的环境中原命令复跑
通过。该失败未通过修改依赖、锁文件或放宽门禁规避。

以上验证使用确定性 Mock Runner 与内存 Store，不调用真实模型或外部业务 API。

## 未完成项

- 尚未增加浏览器层自动点击 CopilotKit STOP 的 CI 测试；当前证据覆盖官方 abort 所依赖的真实
  HTTP 断连路径和服务端取消语义。
- 尚未验证反向代理、Ingress 或 Serverless 平台是否按预期传播客户端断连；部署验收必须加入
  对应基础设施的长流取消测试。
- 取消仍是进程内 Runner + 内存 Store 实现；生产持久队列/分布式执行器需要提供等价的幂等取消。

## 结论

CopilotKit 可选 Shell 的 STOP 语义不再是已知的协议阻断项。该改动没有改变默认 Ant Design X
Shared Chat Core、AG-UI 公开事件契约、权限模型、ContextSnapshot 或 Evidence 边界；CopilotKit
仍因 bundle 体积、生产授权和浏览器自动化缺口保持可选，不具备切换为默认 Shell 的条件。
