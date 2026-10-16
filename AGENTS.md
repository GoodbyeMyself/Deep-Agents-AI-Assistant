# Codex Repository Instructions · AI Assistant V2.0

## 1. 阅读顺序

进入任务时必须阅读：

1. `docs/architecture-v2.0/00-README.md`
2. `docs/architecture-v2.0/01-架构基线与边界.md`
3. `docs/architecture-v2.0/18-架构决策记录.md`
4. 当前阶段 `10-M0`～`15-M5` 的文件及其引用的契约和安全规范。

## 2. 不可修改的架构目标

- **项目定位：企业业务智能体集成框架**，优先实现标准业务契约、原业务权限继承、页面上下文感知、可信结果与追溯。
- **必须保留并完成插件机制**：可信 Adapter 在安装目录启动自动发现、校验、注册 Capability，再由 Tool Factory 挂载到 Deep Agents；M1 是 P0。
- **直接依赖官方 Deep Agents**：不 Fork、不重写 Agent Loop、LangGraph 状态运行机制。官方 TypeScript API 以实际安装包类型和运行测试为准。
- 一套代码，A/B/C 分别独立部署；不做跨实例会话/模型配置同步和动态产品路由；Agent 不感知 A/B/C 身份。
- `core` 提供标准契约，`plugin-sdk` 定义插件开发 API，`adapters` 提供具体 API 映射，`agent-runtime` 薄封装 Deep Agents；禁止循环依赖。
- React + Ant Design X，一个 Shared Chat Core，助手 Shell（React/JS/iframe）与独立 Web Shell 分离。
- 权限与脱敏在服务端和原业务系统强制校验；任何 UI Context/Prompt 不构成授权依据。引用资料再次鉴权。
- 不将插件加载机制升级为 OpenClaw 式完整市场、多渠道 Gateway 或任意上传 JS 执行平台。

## 3. Codex 实施纪律

- 一次只执行一个明确阶段，先审计 repo、Git status、已有代码、依赖，再实施。
- 用户已允许**根据 V2.0 重做 M0**，但不得未授权删除用户未跟踪文件或敏感配置；遇到破坏性操作先明确影响范围。
- 先做可验证实现和测试，再补辅助文档；不批量生成空壳模块。
- Deep Agents、LangChain、Ant Design X 官方 API 不得臆造；PluginLoader、definePlugin、CapabilityRegistry 等是本项目自研接口。
- 缺少真实模型 Key/外部 API 时 Mock 与真实验证明确分开；不得用模拟数据冒充业务集成成功。
- 运行 `pnpm lint`、`pnpm typecheck`、`pnpm build`（建立后均要求执行）。失败必须处理或说明阻断。
- 任何权限/契约变更同时更新 `docs/implementation-status.md` 与 ADR。

## 4. 安全要求

不提交明文模型密钥、长期业务 Token、敏感数据样本；SSE、会话、引用、插件状态 API 均检查当前用户。插件入口仅加载可信、已批准、可校验来源的产物，拒绝路径逃逸；业务层行/列/对象权限最终由业务 API 强制执行。

## 5. 结束时使用固定报告

```text
阶段/任务：
已实现内容与文件：
实际命令、测试结果（真实/Mock/未执行）：
能力契约/安全/Context/Evidence 验证：
与基线差异和 ADR：
剩余问题：
是否通过本阶段退出门禁：
```

完成即停止，不自动推进下一阶段。
