# AI Assistant 企业业务智能体集成架构基线 V2.0

> **定位：企业业务智能体集成框架**（Enterprise AI Agent Integration Framework）  
> **状态：V2.0 已完成历史实施；V2.2 正迁移为一系统一 MCP 架构**
> **日期：2026-10-13**  
> **核心价值：独立业务 MCP 接入、原业务权限继承、页面上下文感知、可信结果与数据可追溯**
> **重要约束：自 2026-10-22 起，以 `22-V2.2-一系统一MCP架构.md` 和 ADR-027 为目标基线；V2.1 与旧 Plugin Bundle 仅作为迁移历史和回滚路径。**

## 1. 一句话目标

以官方 **Deep Agents TypeScript SDK** 为 Harness，为企业系统提供一套**可独立部署、易嵌入、权限受控**的 AI 智能助手平台。每个业务系统通过自己完整、独立的 MCP Server 接入；平台不建设跨系统业务能力标准化层。**不以复刻 OpenClaw 为目标**。

## 2. 谁先读什么

- 架构师/负责人：`01`、`02`、`03`、`18`。
- 业务 MCP 研发：`08`、`16`、`22`。
- Agent 研发：`04`、`06`、`08`、`09`。
- Web 研发：`07`、`09`、`08`。
- Codex：仓库根目录 `AGENTS.md`、本文件、`01`～`03`、当前 Mx 对应文档，执行前查阅相关规范；从 `CODEX-START-HERE.md` 开始。

## 3. 文档索引

| 文件                              | 内容                                              | 类型     |
| --------------------------------- | ------------------------------------------------- | -------- |
| `00-README.md`                    | 导航、优先级、迁移说明                            | 入口     |
| `01-架构基线与边界.md`            | 产品定位、总体架构、非目标、核心决策              | 规范     |
| `02-需求追踪矩阵.md`              | 原始 17 项需求与 MVP/后续阶段映射                 | 规范     |
| `03-工程结构与依赖规则.md`        | Monorepo 结构与依赖方向                           | 规范     |
| `04-核心领域契约与上下文.md`      | Capability/Context/Policy/Evidence/Result         | 规范     |
| `05-插件系统与能力注册.md`        | SDK、Manifest、Loader、Registry、Tool Factory     | 核心规范 |
| `06-DeepAgents运行时设计.md`      | Agent Factory、Runner、Skills、Subagents、Backend | 支撑规范 |
| `07-前端与SDK设计.md`             | React + Ant Design X、双 Web 模式、三种 SDK       | 支撑规范 |
| `08-安全权限证据与审计.md`        | 授权强制执行、审计与证据可信                      | 核心规范 |
| `09-API数据模型与事件协议.md`     | Session/Run/Context HTTP 与 SSE                   | 支撑规范 |
| `10-M0-工程初始化与框架验证.md`   | **从头重新执行** Deep Agents 框架验证             | 阶段任务 |
| `11-M1-插件自动挂载POC.md`        | 必备自动挂载和双插件契约 POC                      | 阶段任务 |
| `12-M2-Agent服务与会话闭环.md`    | 身份、业务授权、证据、会话与 SSE                  | 阶段任务 |
| `13-M3-React独立Web与共享聊天.md` | Shared Chat、独立模式与基础管理                   | 阶段任务 |
| `14-M4-嵌入助手与三类SDK.md`      | 业务页面感知、React/JS/iframe                     | 阶段任务 |
| `15-M5-独立部署与系统验收.md`     | 两套独立部署和业务契约一致性验收                  | 阶段任务 |
| `16-测试体系与质量门禁.md`        | 自动测试、越权与适配一致性用例                    | 全阶段   |
| `17-Codex执行手册.md`             | 逐阶段指令、报告与基线变更规则                    | 开发入口 |
| `18-架构决策记录.md`              | ADR 与明确暂缓项                                  | 规范     |
| `19-原始需求全文.md`              | 用户原始 17 条需求                                | 需求来源 |
| `20-业务领域扩展路线图.md`        | 其余业务领域后续扩展                              | 后续规划 |
| `21-V2.1-外部MCP业务能力架构.md`  | 外部 MCP 第一版迁移设计（已被 V2.2 取代）          | 历史规范 |
| `22-V2.2-一系统一MCP架构.md`      | **一系统一 MCP、无通用业务能力层、清理边界**       | 当前核心规范 |
| `AGENTS.md`                       | Codex 常驻规则（复制至仓库根）                    | 开发入口 |
| `CODEX-START-HERE.md`             | 第一次重执行 M0 的提示词                          | 开发入口 |

## 4. 开发优先级与完成标志

### 核心不可妥协

1. **一系统一 MCP**：每个系统独立定义 Tool 和 Schema；平台不抽象、转换或统一 Product A/B 的业务能力。
2. **业务权限继承**：模型不能自行决定授权；工具调用执行时调用原平台业务授权，敏感数据沿用原平台脱敏规则。
3. **页面上下文感知**：React/JS/iframe 对同一标准 Context 协议提供当前页面/对象；每次 Run 固定 ContextSnapshot，身份由服务端确认。
4. **可信结果**：来源、范围、统计时间、口径与数据不足状态与回答一起交付。
5. **受治理的 MCP 能力挂载**：批准连接→发现 Tool→校验 Schema/权限/风险→固定 Snapshot→Tool Factory→Deep Agents。

### 为实现上述价值服务，不建设 OpenClaw 式通用平台

复用 Deep Agents 的执行、Skills、Subagents、状态；实现薄 Agent Server、必要模型和会话配置、双 Web 模式；**不做**通用 IM 渠道、插件市场、未审核第三方代码热加载、跨产品会话迁移、全自动业务写入或复杂任务调度。

## 5. V2.0 对旧基线的变化

- **重新定位**：从泛化智能体平台，收敛为企业业务智能体集成框架。
- **V2.2 一系统一 MCP**：每个业务系统在 MCP 开发根拥有独立项目；不保留共享 Domain、Adapter 或统一业务契约。
- **核心顺序调整**：权限继承、页面感知、证据追溯和 MCP 治理的优先级高于跨系统业务标准化。
- **M0 可重做**：本包不假设旧 M0 已完成，不要求迁移旧 M0 代码；Codex 在当前仓库工作时仍必须先核对现状、保护未授权修改的数据。
- **部署模式调整**：同一平台发行版可连接当前部署批准的独立 MCP；A/B/C 的 MCP、凭证、会话和存储互不互通。

## 6. 版本与参考资料

所有 API 的实际参数**以 M0 安装包类型定义、真实测试和版本锁为准**，不得把本文件的伪代码当作官方实现。参考：

- [Deep Agents TypeScript Overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
- [Deep Agents Customization](https://docs.langchain.com/oss/javascript/deepagents/customization)
- [Deep Agents Skills](https://docs.langchain.com/oss/javascript/deepagents/skills)
- [Deep Agents Subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)
- [Deep Agents Streaming](https://docs.langchain.com/oss/javascript/deepagents/streaming)
- [Ant Design X](https://x.ant.design/)
