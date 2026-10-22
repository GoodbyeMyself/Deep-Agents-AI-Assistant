# Codex Repository Instructions · AI Assistant V2.0

## 1. 阅读顺序

进入任务时必须阅读：

1. `docs/architecture-v2.0/00-README.md`
2. `docs/architecture-v2.0/01-架构基线与边界.md`
3. `docs/architecture-v2.0/22-V2.2-一系统一MCP架构.md`
4. `docs/architecture-v2.0/21-V2.1-外部MCP业务能力架构.md`（历史迁移背景）
5. `docs/architecture-v2.0/18-架构决策记录.md`
6. 当前阶段文件及其引用的契约和安全规范。

## 2. 不可修改的架构目标

- **项目定位：企业业务智能体平台**，优先实现受治理的 MCP 接入、原业务权限继承、页面上下文感知、可信结果与追溯；不建设跨系统标准业务契约层。
- **目标业务能力机制是一系统一 MCP**：Product A/B/C 各自拥有完整、独立的 MCP 项目；不建设跨系统标准业务能力层、共享 Domain、统一业务契约或 Adapter/Plugin 层。旧 Plugin Runtime 已从目标代码删除。
- **平台只做平台能力**：主仓不得新增业务 Capability Catalog、业务 Schema、业务权限名称、业务错误语义或产品契约测试；这些全部属于 MCP 仓。主仓只做身份/会话/Run/Context、Agent Runtime、MCP 连接治理、通用安全、审计与交互平台。
- **直接依赖官方 Deep Agents**：不 Fork、不重写 Agent Loop、LangGraph 状态运行机制。官方 TypeScript API 以实际安装包类型和运行测试为准。
- 平台一套代码可分别部署并连接当前系统批准的 MCP；不做跨实例会话/模型配置同步、跨系统业务归一化或动态产品路由。
- `core` 只提供与业务无关的 Context/平台 Policy/Evidence 传输等平台契约；每个产品 MCP 独占自己的 Tool、Schema、业务授权语义和 API 映射，`agent-runtime` 薄封装 Deep Agents；禁止两个仓库使用 workspace、相对路径或 `file:` 依赖形成隐式耦合。
- React + Ant Design X，一个 Shared Chat Core，助手 Shell（React/JS/iframe）与独立 Web Shell 分离。
- 权限与脱敏在服务端和原业务系统强制校验；任何 UI Context/Prompt 不构成授权依据。引用资料再次鉴权。
- 不将 MCP 接入升级为任意公网 Server 市场、多渠道 Gateway 或未经批准的动态 Tool 执行平台。

## 3. Codex 实施纪律

- 一次只执行一个明确阶段，先审计 repo、Git status、已有代码、依赖，再实施。
- 用户已允许**根据 V2.0 重做 M0**，但不得未授权删除用户未跟踪文件或敏感配置；遇到破坏性操作先明确影响范围。
- 先做可验证实现和测试，再补辅助文档；不批量生成空壳模块。
- Deep Agents、LangChain、Ant Design X、MCP 官方 API 不得臆造；实现前以实际锁定包类型和运行测试为准。
- 缺少真实模型 Key/外部 API 时 Mock 与真实验证明确分开；不得用模拟数据冒充业务集成成功。
- **所有 `pnpm` 命令必须由用户本人执行。Codex 禁止运行任何 `pnpm` 命令**（包括但不限于安装、启动、Lint、测试、类型检查和构建），也不得为绕过该限制改用其他命令间接触发 `pnpm`。Codex 只能向用户列出建议执行的命令，并依据用户提供的真实输出继续处理。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`（建立后）仍是退出门禁；在用户尚未提供执行结果时，必须报告为“未执行/待用户验证”，不得自行补跑或宣称通过。
- 任何权限/契约变更同时更新 `docs/implementation-status.md` 与 ADR。

## 4. 安全要求

不提交明文模型密钥、长期业务 Token、敏感数据样本；SSE、会话、引用、MCP 状态 API 均检查当前用户。MCP 连接、Server、Tool、Schema、权限和风险必须显式批准；限制网络目标并防止 SSRF。业务层行/列/对象权限最终由 MCP Server 和原业务 API 强制执行。

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
